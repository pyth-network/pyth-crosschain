import { HexString, PriceFeed } from "@pythnetwork/pyth-evm-js";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PriceConfig } from "./price-config";
import { PriceInfo, PriceListener } from "./interface";

export class PythPriceListener implements PriceListener {
  private connection: PriceServiceConnection;
  private priceIds: HexString[];
  private priceIdToAlias: Map<HexString, string>;
  private latestPriceInfo: Map<HexString, PriceInfo>;

  constructor(connection: PriceServiceConnection, priceConfigs: PriceConfig[]) {
    this.connection = connection;
    this.priceIds = priceConfigs.map((priceConfig) => priceConfig.id);
    this.priceIdToAlias = new Map(
      priceConfigs.map((priceConfig) => [priceConfig.id, priceConfig.alias])
    );
    this.latestPriceInfo = new Map();
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
  }

  private onNewPriceFeed(priceFeed: PriceFeed) {
    console.log(
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
  }

  getLatestPriceInfo(priceId: string): PriceInfo | undefined {
    return this.latestPriceInfo.get(priceId);
  }
}
