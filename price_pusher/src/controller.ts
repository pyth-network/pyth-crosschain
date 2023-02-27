import { UnixTimestamp } from "@pythnetwork/pyth-common-js";
import { DurationInSeconds, sleep } from "./utils";
import { ChainPricePusher, IPriceListener } from "./interface";
import { PriceConfig, shouldUpdate } from "./price-config";

export class Controller {
  private cooldownDuration: DurationInSeconds;
  constructor(
    private priceConfigs: PriceConfig[],
    private sourcePriceListener: IPriceListener,
    private targetPriceListener: IPriceListener,
    private targetChainPricePusher: ChainPricePusher,
    config: {
      cooldownDuration: DurationInSeconds;
    }
  ) {
    this.cooldownDuration = config.cooldownDuration;
  }

  async start() {
    for (;;) {
      const pricesToPush: PriceConfig[] = [];
      const pubTimesToPush: UnixTimestamp[] = [];

      for (const priceConfig of this.priceConfigs) {
        const priceId = priceConfig.id;

        const targetLatestPrice =
          this.targetPriceListener.getLatestPriceInfo(priceId);
        const sourceLatestPrice =
          this.sourcePriceListener.getLatestPriceInfo(priceId);

        if (shouldUpdate(priceConfig, sourceLatestPrice, targetLatestPrice)) {
          pricesToPush.push(priceConfig);
          pubTimesToPush.push((targetLatestPrice?.publishTime || 0) + 1);
        }
      }
      // note that the priceIds are without leading "0x"
      const priceIds = pricesToPush.map((priceConfig) => priceConfig.id);
      this.targetChainPricePusher.updatePriceFeed(priceIds, pubTimesToPush);
      await sleep(this.cooldownDuration * 1000);
    }
  }
}
