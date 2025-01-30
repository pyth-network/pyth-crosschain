import {
  HexString,
  HermesClient,
  PriceUpdate,
} from "@pythnetwork/hermes-client";
import { PriceInfo, IPriceListener, PriceItem } from "./interface";
import { Logger } from "pino";
import { PriceFeed } from "@pythnetwork/price-service-sdk";

type TimestampInMs = number & { readonly _: unique symbol };

export class PythPriceListener implements IPriceListener {
  private connection: HermesClient;
  private priceIds: HexString[];
  private priceIdToAlias: Map<HexString, string>;
  private latestPriceInfo: Map<HexString, PriceInfo>;
  private logger: Logger;
  private lastUpdated: TimestampInMs | undefined;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    connection: HermesClient,
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
    this.connection.getPriceUpdatesStream(
      this.priceIds,
    );

    try {
      const priceUpdates = await this.connection.getLatestPriceUpdates(
        this.priceIds,
        {
          encoding: "hex",
          parsed: true,
          ignoreInvalidPriceIds: true,
        }
      );
      priceUpdates.parsed?.forEach((priceUpdate) => {
        this.latestPriceInfo.set(priceUpdate.id, {
          price: priceUpdate.price.price,
          conf: priceUpdate.price.conf,
          publishTime: priceUpdate.price.publish_time,
        });
      });
    } catch (error: any) {
      // Always log the HTTP error first
      this.logger.error("Failed to get latest price feeds:", error);
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

  getLatestPriceInfo(priceId: string): PriceInfo | undefined {
    return this.latestPriceInfo.get(priceId);
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
