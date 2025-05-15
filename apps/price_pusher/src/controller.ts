import { UnixTimestamp } from "@pythnetwork/hermes-client";
import { DurationInSeconds, sleep } from "./utils";
import { IPriceListener, IPricePusher } from "./interface";
import { PriceConfig, shouldUpdate, UpdateCondition } from "./price-config";
import { Logger } from "pino";
import { PricePusherMetrics } from "./metrics";

export class Controller {
  private pushingFrequency: DurationInSeconds;
  private metrics?: PricePusherMetrics;

  constructor(
    private priceConfigs: PriceConfig[],
    private sourcePriceListener: IPriceListener,
    private targetPriceListener: IPriceListener,
    private targetChainPricePusher: IPricePusher,
    private logger: Logger,
    config: {
      pushingFrequency: DurationInSeconds;
      metrics?: PricePusherMetrics;
    },
  ) {
    this.pushingFrequency = config.pushingFrequency;
    this.metrics = config.metrics;

    // Set the number of price feeds if metrics are enabled
    this.metrics?.setPriceFeedsTotal(this.priceConfigs.length);
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
        const alias = priceConfig.alias;

        const targetLatestPrice =
          this.targetPriceListener.getLatestPriceInfo(priceId);
        const sourceLatestPrice =
          this.sourcePriceListener.getLatestPriceInfo(priceId);

        if (this.metrics && targetLatestPrice && sourceLatestPrice) {
          this.metrics.updateTimestamps(
            priceId,
            alias,
            targetLatestPrice.publishTime,
            sourceLatestPrice.publishTime,
            priceConfig.timeDifference,
          );
        }

        const priceShouldUpdate = shouldUpdate(
          priceConfig,
          sourceLatestPrice,
          targetLatestPrice,
          this.logger,
        );

        // Record update condition in metrics
        if (this.metrics) {
          this.metrics.recordUpdateCondition(priceId, alias, priceShouldUpdate);
        }

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
        this.logger.info(
          {
            priceIds: pricesToPush.map((priceConfig) => ({
              id: priceConfig.id,
              alias: priceConfig.alias,
            })),
          },
          "Some of the checks triggered pushing update. Will push the updates for some feeds.",
        );

        // note that the priceIds are without leading "0x"
        const priceIds = pricesToPush.map((priceConfig) => priceConfig.id);

        try {
          await this.targetChainPricePusher.updatePriceFeed(
            priceIds,
            pubTimesToPush,
          );

          // Record successful updates
          if (this.metrics) {
            for (const config of pricesToPush) {
              const triggerValue =
                shouldUpdate(
                  config,
                  this.sourcePriceListener.getLatestPriceInfo(config.id),
                  this.targetPriceListener.getLatestPriceInfo(config.id),
                  this.logger,
                ) === UpdateCondition.YES
                  ? "yes"
                  : "early";

              this.metrics.recordPriceUpdate(
                config.id,
                config.alias,
                triggerValue,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            { error, priceIds },
            "Error pushing price updates to chain",
          );

          // Record errors in metrics
          if (this.metrics) {
            for (const config of pricesToPush) {
              const triggerValue =
                shouldUpdate(
                  config,
                  this.sourcePriceListener.getLatestPriceInfo(config.id),
                  this.targetPriceListener.getLatestPriceInfo(config.id),
                  this.logger,
                ) === UpdateCondition.YES
                  ? "yes"
                  : "early";

              this.metrics.recordPriceUpdateError(
                config.id,
                config.alias,
                triggerValue,
              );
            }
          }
        }
      } else {
        this.logger.info("None of the checks were triggered. No push needed.");
      }

      await sleep(this.pushingFrequency * 1000);
    }
  }
}
