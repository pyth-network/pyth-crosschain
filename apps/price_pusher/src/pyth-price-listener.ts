import {
  HexString,
  HermesClient,
  PriceUpdate,
} from "@pythnetwork/hermes-client";
import { PriceInfo, IPriceListener, PriceItem } from "./interface";
import { Logger } from "pino";
import { sleep } from "./utils";

type TimestampInMs = number & { readonly _: unique symbol };

export class PythPriceListener implements IPriceListener {
  private hermesClient: HermesClient;
  private priceIds: HexString[];
  private priceIdToAlias: Map<HexString, string>;
  private latestPriceInfo: Map<HexString, PriceInfo>;
  private logger: Logger;
  private lastUpdated: TimestampInMs | undefined;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    hermesClient: HermesClient,
    priceItems: PriceItem[],
    logger: Logger,
  ) {
    this.hermesClient = hermesClient;
    this.priceIds = priceItems.map((priceItem) => priceItem.id);
    this.priceIdToAlias = new Map(
      priceItems.map((priceItem) => [priceItem.id, priceItem.alias]),
    );
    this.latestPriceInfo = new Map();
    this.logger = logger;
  }

  // This method should be awaited on and once it finishes it has the latest value
  // for the given price feeds (if they exist).
  async start() {
    this.startListening();

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

  async startListening() {
    this.logger.info(
      `Starting to listen for price updates from Hermes for ${this.priceIds.length} price feeds.`,
    );

    const eventSource = await this.hermesClient.getPriceUpdatesStream(
      this.priceIds,
      {
        parsed: true,
        ignoreInvalidPriceIds: true,
      },
    );
    eventSource.onmessage = (event: MessageEvent<string>) => {
      const priceUpdates = JSON.parse(event.data) as PriceUpdate;
      priceUpdates.parsed?.forEach((priceUpdate) => {
        this.logger.debug(
          `Received new price feed update from Pyth price service: ${this.priceIdToAlias.get(
            priceUpdate.id,
          )} ${priceUpdate.id}`,
        );

        // Consider price to be currently available if it is not older than 60s
        const currentPrice =
          Date.now() / 1000 - priceUpdate.price.publish_time > 60
            ? undefined
            : priceUpdate.price;
        if (currentPrice === undefined) {
          this.logger.debug("Price is older than 60s, skipping");
          return;
        }

        const priceInfo: PriceInfo = {
          conf: currentPrice.conf,
          price: currentPrice.price,
          publishTime: currentPrice.publish_time,
        };

        this.latestPriceInfo.set(priceUpdate.id, priceInfo);
        this.lastUpdated = Date.now() as TimestampInMs;
      });
    };

    eventSource.onerror = async (error: Event) => {
      console.error("Error receiving updates from Hermes:", error);
      eventSource.close();
      await sleep(5000); // Wait a bit before trying to reconnect
      this.startListening(); // Attempt to restart the listener
    };
  }

  getLatestPriceInfo(priceId: HexString): PriceInfo | undefined {
    return this.latestPriceInfo.get(priceId);
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
