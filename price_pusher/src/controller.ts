import { UnixTimestamp } from "@pythnetwork/price-service-client";
import { DurationInSeconds, sleep } from "./utils";
import { IPricePusher, IPriceListener } from "./interface";
import { PriceConfig, shouldUpdate } from "./price-config";

export class Controller {
  private pushingFrequency: DurationInSeconds;
  constructor(
    private priceConfigs: PriceConfig[],
    private sourcePriceListener: IPriceListener,
    private targetPriceListener: IPriceListener,
    private targetChainPricePusher: IPricePusher,
    config: {
      pushingFrequency: DurationInSeconds;
    }
  ) {
    this.pushingFrequency = config.pushingFrequency;
  }

  async start() {
    // start the listeners
    await this.sourcePriceListener.start();
    await this.targetPriceListener.start();

    // wait for the listeners to get updated. There could be a restart
    // before this run and we need to respect the cooldown duration as
    // their might be a message sent before.
    await sleep(this.pushingFrequency * 1000);

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
      if (pricesToPush.length !== 0) {
        console.log(
          "Some of the above values passed the threshold. Will push the price."
        );

        // note that the priceIds are without leading "0x"
        const priceIds = pricesToPush.map((priceConfig) => priceConfig.id);
        this.targetChainPricePusher.updatePriceFeed(priceIds, pubTimesToPush);
      } else {
        console.log(
          "None of the above values passed the threshold. No push needed."
        );
      }

      await sleep(this.pushingFrequency * 1000);
    }
  }
}
