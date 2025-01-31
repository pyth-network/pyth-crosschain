import {
  HexString,
  HermesClient,
  PriceUpdate,
} from "@pythnetwork/hermes-client";
import { PriceInfo, IPriceListener, PriceItem } from "./interface";
import { Logger } from "pino";

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
    logger: Logger
  ) {
    this.hermesClient = hermesClient;
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
    const priceMetadata = await this.hermesClient.getPriceFeeds();
    const allPriceIds = priceMetadata.map((priceMetadata) => priceMetadata.id);

    // Filter out invalid price ids
    const { existingPriceIds, invalidPriceIds } = this.priceIds.reduce<{
      existingPriceIds: string[];
      invalidPriceIds: string[];
    }>(
      (acc, id) => {
        if (allPriceIds.includes(id)) {
          acc.existingPriceIds.push(id);
        } else {
          acc.invalidPriceIds.push(id);
        }
        return acc;
      },
      { existingPriceIds: [], invalidPriceIds: [] }
    );

    const invalidPriceIdsWithAlias = invalidPriceIds.map((id) =>
      this.priceIdToAlias.get(id)
    );
    this.logger.error(
      `Invalid price id submitted for: ${invalidPriceIdsWithAlias.join(", ")}`
    );

    this.priceIds = existingPriceIds;
    // TODO: We can just remove the invalid price ids from the map
    this.priceIdToAlias = new Map(
      existingPriceIds.map(
        (id) => [id, this.priceIdToAlias.get(id)] as [HexString, string]
      )
    );

    const eventSource = await this.hermesClient.getPriceUpdatesStream(
      this.priceIds,
      {
        parsed: true,
        ignoreInvalidPriceIds: true,
      }
    );
    eventSource.onmessage = (event: MessageEvent<string>) => {
      const priceUpdates = JSON.parse(event.data) as PriceUpdate;
      priceUpdates.parsed?.forEach((priceUpdate) => {
        this.logger.debug(
          `Received new price feed update from Pyth price service: ${this.priceIdToAlias.get(
            priceUpdate.id
          )} ${priceUpdate.id}`
        );

        // Consider price to be currently available if it is not older than 60s
        const currentPrice =
          Date.now() / 1000 - priceUpdate.price.publish_time > 60
            ? undefined
            : priceUpdate.price;
        if (currentPrice === undefined) {
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

    eventSource.onerror = (error: Event) => {
      console.error("Error receiving updates from Hermes:", error);
      eventSource.close();
    };

    // try {
    //   const priceUpdates = await this.hermesClient.getLatestPriceUpdates(
    //     this.priceIds,
    //     {
    //       encoding: "hex",
    //       parsed: true,
    //       ignoreInvalidPriceIds: true,
    //     }
    //   );
    //   priceUpdates.parsed?.forEach((priceUpdate) => {
    //     this.latestPriceInfo.set(priceUpdate.id, {
    //       price: priceUpdate.price.price,
    //       conf: priceUpdate.price.conf,
    //       publishTime: priceUpdate.price.publish_time,
    //     });
    //   });
    // } catch (error: any) {
    //   // Always log the HTTP error first
    //   this.logger.error("Failed to get latest price feeds:", error);
    // }

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
