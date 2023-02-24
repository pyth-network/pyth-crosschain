import { HexString } from "@pythnetwork/pyth-common-js";
import { ChainPricePusher, PriceInfo, PriceListener } from "./interface";
import { DurationInSeconds } from "./utils";
import { PriceConfig } from "./price-config";
import { ChainGrpcWasmApi } from "@injectivelabs/sdk-ts";

type PriceQueryResponse = {
  price_feed: {
    id: string;
    price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
  };
};

// this use price without leading 0x
export class InjectivePriceListener implements PriceListener {
  private latestPriceInfo: Map<HexString, PriceInfo>;
  private priceIds: HexString[];

  private pollingFrequency: DurationInSeconds;

  constructor(
    private contractAddress: string,
    private grpcEndpoint: string,
    priceConfigs: PriceConfig[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    this.latestPriceInfo = new Map();
    this.priceIds = priceConfigs.map((priceConfig) => priceConfig.id);

    this.pollingFrequency = config.pollingFrequency;
  }

  async start() {
    console.log(`Polling the prices every ${this.pollingFrequency} seconds...`);
    setInterval(this.pollPrices.bind(this), this.pollingFrequency * 1000);

    await this.pollPrices();
  }

  private async pollPrices() {
    console.log("Polling injective prices...");
    for (const priceId of this.priceIds) {
      const currentPriceInfo = await this.getOnChainPriceInfo(priceId);
      if (currentPriceInfo !== undefined) {
        this.updateLatestPriceInfo(priceId, currentPriceInfo);
      }
    }
  }

  async getOnChainPriceInfo(
    priceId: HexString
  ): Promise<PriceInfo | undefined> {
    let priceQueryResponse: PriceQueryResponse;
    try {
      const api = new ChainGrpcWasmApi(this.grpcEndpoint);
      const { data } = await api.fetchSmartContractState(
        this.contractAddress,
        Buffer.from(`{"price_feed":{"id":"${priceId}"}}`).toString("base64")
      );

      const json = Buffer.from(data as string, "base64").toString();
      priceQueryResponse = JSON.parse(json);
    } catch (e) {
      console.error(`Getting on-chain price for ${priceId} failed. Error:`);
      console.error(e);
      return undefined;
    }

    return {
      conf: priceQueryResponse.price_feed.price.conf,
      price: priceQueryResponse.price_feed.price.price,
      publishTime: priceQueryResponse.price_feed.price.publish_time,
    };
  }

  private updateLatestPriceInfo(priceId: HexString, observedPrice: PriceInfo) {
    const cachedLatestPriceInfo = this.getLatestPriceInfo(priceId);

    // Ignore the observed price if the cache already has newer
    // price. This could happen because we are using polling and
    // subscription at the same time.
    if (
      cachedLatestPriceInfo !== undefined &&
      cachedLatestPriceInfo.publishTime > observedPrice.publishTime
    ) {
      return;
    }

    this.latestPriceInfo.set(priceId, observedPrice);
  }

  getLatestPriceInfo(priceId: string): PriceInfo | undefined {
    return this.latestPriceInfo.get(priceId);
  }
}

export class InjectivePricePusher implements ChainPricePusher {
  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[]
  ): Promise<void> {
    console.log("dummy pushed");
  }
}
