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
    this.connection.subscribePriceFeedUpdates(
      this.priceIds,
      this.onNewPriceFeed.bind(this)
    );

    const priceFeeds = await this.connection.getLatestPriceFeeds(this.priceIds);
    priceFeeds?.forEach((priceFeed) => {
      // Getting unchecked because although it might be old
      // but might not be there on the target chain.
      const latestAvailablePrice = priceFeed.getPriceUnchecked();
      this.latestPriceInfo.set(priceFeed.id, {
        price: latestAvailablePrice.price,
        conf: latestAvailablePrice.conf,
        publishTime: latestAvailablePrice.publishTime,
      });
    });

    // Check health of the price feeds 5 second. If the price feeds are not updating
    // for more than 30s, throw an error.
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = now - 30 * 1000;

      // Check if we've never received any updates
      if (this.lastUpdated === undefined) {
        this.logger.warn(
          {
            currentTime: now,
          },
          "No price feed updates have been received yet"
        );
        return;
      }

      // Find stale price feeds
      const staleFeeds = Array.from(this.latestPriceInfo.entries())
        .filter(([, info]) => info.publishTime * 1000 < staleThreshold)
        .map(([id, info]) => ({
          id,
          alias: this.priceIdToAlias.get(id),
          lastPublishTime: info.publishTime,
        }));

      if (staleFeeds.length > 0) {
        this.logger.warn(
          {
            staleFeeds,
            currentTime: now,
          },
          `${staleFeeds.length} price feeds haven't updated in the last 30 seconds`
        );
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
}
