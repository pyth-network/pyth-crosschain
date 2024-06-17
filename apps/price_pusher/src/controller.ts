import { UnixTimestamp } from "@pythnetwork/price-service-client";
import { DurationInSeconds, sleep } from "./utils";
import { IPriceListener, IPricePusher } from "./interface";
import { PriceConfig, shouldUpdate, UpdateCondition } from "./price-config";
import { Request, Response } from "express";

export class Controller {
  private pushingFrequency: DurationInSeconds;
  private lastPushTimes: Map<string, UnixTimestamp> = new Map();
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
    for (const priceConfig of this.priceConfigs) {
      this.lastPushTimes.set(priceConfig.id, Date.now());
    }
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
      // We will push all prices whose update condition is YES or EARLY as long as there is
      // at least one YES.
      let pushThresholdMet = false;
      const pricesToPush: PriceConfig[] = [];
      const pubTimesToPush: UnixTimestamp[] = [];

      for (const priceConfig of this.priceConfigs) {
        const priceId = priceConfig.id;

        const targetLatestPrice =
          this.targetPriceListener.getLatestPriceInfo(priceId);
        this.lastPushTimes.set(priceId, targetLatestPrice?.publishTime || 0);

        const sourceLatestPrice =
          this.sourcePriceListener.getLatestPriceInfo(priceId);

        const priceShouldUpdate = shouldUpdate(
          priceConfig,
          sourceLatestPrice,
          targetLatestPrice
        );
        if (priceShouldUpdate == UpdateCondition.YES) {
          pushThresholdMet = true;
        }

        if (
          priceShouldUpdate == UpdateCondition.YES ||
          priceShouldUpdate == UpdateCondition.EARLY
        ) {
          pricesToPush.push(priceConfig);
          pubTimesToPush.push((targetLatestPrice?.publishTime || 0) + 1);
        }
      }
      if (pushThresholdMet) {
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

  handleHealthCheck = () => {
    return (_req: Request, res: Response,) => {
      const now = Date.now();
      
      let healthy = true;
      for (const priceConfig of this.priceConfigs) {
        healthy = (now - this.lastPushTimes.get(priceConfig.id)!) > 2 * priceConfig.timeDifference
      }
      if (healthy) {
        res.writeHead(200);
        res.end("Healthy");
      } else {
        res.writeHead(500);
        res.end("Unhealthy");
      }
      return;
  }};
}
