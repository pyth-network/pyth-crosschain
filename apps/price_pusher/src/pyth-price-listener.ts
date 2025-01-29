import {
  HexString,
  PriceFeed,
  PriceServiceConnection,
} from "@pythnetwork/price-service-client";
import { PriceInfo, IPriceListener, PriceItem } from "./interface";
import { Logger } from "pino";

type TimestampInMs = number & { readonly _: unique symbol };

export class PythPriceListener implements IPriceListener {
  private connection: PriceServiceConnection;
  private priceIds: HexString[];
  private priceIdToAlias: Map<HexString, string>;
  private latestPriceInfo: Map<HexString, PriceInfo>;
  private logger: Logger;
  private lastUpdated: TimestampInMs | undefined;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    connection: PriceServiceConnection,
    priceItems: PriceItem[],
    logger: Logger
  ) {
    this.connection = connection;
    this.priceIds = priceItems.map((priceItem) => priceItem.id);
    this.priceIdToAlias = new Map(
      priceItems.map((priceItem) => [priceItem.id, priceItem.alias])
    );
    this.latestPriceInfo = new Map();
    this.logger = logger;
  }

  // This method should be awaited on and once it finishes it has the latest value
  // for the given price feeds (if they exist).
  async start() {
    // Set custom error handler for websocket errors
    this.connection.onWsError = (error: Error) => {
      if (error.message.includes("not found")) {
        // Extract invalid feed IDs from error message
        const match = error.message.match(/\[(.*?)\]/);
        if (match) {
          const invalidFeedIds = match[1].split(",").map((id) => {
            // Remove '0x' prefix if present to match our stored IDs
            return id.trim().replace(/^0x/, "");
          });

          // Log invalid feeds with their aliases
          invalidFeedIds.forEach((id) => {
            this.logger.error(
              `Price feed ${id} (${this.priceIdToAlias.get(
                id
              )}) not found for subscribePriceFeedUpdates`
            );
          });

          // Filter out invalid feeds and resubscribe with valid ones
          const validFeeds = this.priceIds.filter(
            (id) => !invalidFeedIds.includes(id)
          );

          this.priceIds = validFeeds;

          if (validFeeds.length > 0) {
            this.logger.info("Resubscribing with valid feeds only");
            this.connection.subscribePriceFeedUpdates(
              validFeeds,
              this.onNewPriceFeed.bind(this)
            );
          }
        }
      } else {
        this.logger.error("Websocket error occurred:", error);
      }
    };

    this.connection.subscribePriceFeedUpdates(
      this.priceIds,
      this.onNewPriceFeed.bind(this)
    );

    try {
      const priceFeeds = await this.connection.getLatestPriceFeeds(
        this.priceIds
      );
      priceFeeds?.forEach((priceFeed) => {
        const latestAvailablePrice = priceFeed.getPriceUnchecked();
        this.latestPriceInfo.set(priceFeed.id, {
          price: latestAvailablePrice.price,
          conf: latestAvailablePrice.conf,
          publishTime: latestAvailablePrice.publishTime,
        });
      });
    } catch (error: any) {
      // Always log the HTTP error first
      this.logger.error("Failed to get latest price feeds:", error);

      if (error.response.data.includes("Price ids not found:")) {
        // Extract invalid feed IDs from error message
        const invalidFeedIds = error.response.data
          .split("Price ids not found:")[1]
          .split(",")
          .map((id: string) => id.trim().replace(/^0x/, ""));

        // Log invalid feeds with their aliases
        invalidFeedIds.forEach((id: string) => {
          this.logger.error(
            `Price feed ${id} (${this.priceIdToAlias.get(
              id
            )}) not found for getLatestPriceFeeds`
          );
        });

        // Filter out invalid feeds and retry
        const validFeeds = this.priceIds.filter(
          (id) => !invalidFeedIds.includes(id)
        );

        this.priceIds = validFeeds;

        if (validFeeds.length > 0) {
          this.logger.info(
            "Retrying getLatestPriceFeeds with valid feeds only"
          );
          const validPriceFeeds = await this.connection.getLatestPriceFeeds(
            validFeeds
          );
          validPriceFeeds?.forEach((priceFeed) => {
            const latestAvailablePrice = priceFeed.getPriceUnchecked();
            this.latestPriceInfo.set(priceFeed.id, {
              price: latestAvailablePrice.price,
              conf: latestAvailablePrice.conf,
              publishTime: latestAvailablePrice.publishTime,
            });
          });
        }
      }
    }

    // Store health check interval reference
    this.healthCheckInterval = setInterval(() => {
      if (
        this.lastUpdated === undefined ||
        this.lastUpdated < Date.now() - 30 * 1000
      ) {
        throw new Error("Hermes Price feeds are not updating.");
      }
    }, 5000);
  }

  private onNewPriceFeed(priceFeed: PriceFeed) {
    this.logger.debug(
      `Received new price feed update from Pyth price service: ${this.priceIdToAlias.get(
        priceFeed.id
      )} ${priceFeed.id}`
    );

    // Consider price to be currently available if it is not older than 60s
    const currentPrice = priceFeed.getPriceNoOlderThan(60);
    if (currentPrice === undefined) {
      return;
    }

    const priceInfo: PriceInfo = {
      conf: currentPrice.conf,
      price: currentPrice.price,
      publishTime: currentPrice.publishTime,
    };

    this.latestPriceInfo.set(priceFeed.id, priceInfo);
    this.lastUpdated = Date.now() as TimestampInMs;
  }

  getLatestPriceInfo(priceId: string): PriceInfo | undefined {
    return this.latestPriceInfo.get(priceId);
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
