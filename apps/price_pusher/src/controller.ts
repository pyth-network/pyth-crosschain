import { UnixTimestamp } from "@pythnetwork/hermes-client";
import { DurationInSeconds, sleep } from "./utils";
import { IPriceListener, IPricePusher } from "./interface";
import { PriceConfig, shouldUpdate, UpdateCondition } from "./price-config";
import { Logger } from "pino";
import { PricePusherMetrics } from "./metrics";
import { SuperWalletClient } from "./evm/super-wallet";

// Define the wallet balance info interface
interface WalletBalanceInfo {
  client: SuperWalletClient;
  address: `0x${string}`;
  network: string;
  updateInterval: DurationInSeconds;
}

export class Controller {
  private pushingFrequency: DurationInSeconds;
  private metrics?: PricePusherMetrics;
  private walletBalanceInfo?: WalletBalanceInfo;

  constructor(
    private priceConfigs: PriceConfig[],
    private sourcePriceListener: IPriceListener,
    private targetPriceListener: IPriceListener,
    private targetChainPricePusher: IPricePusher,
    private logger: Logger,
    config: {
      pushingFrequency: DurationInSeconds;
      metrics?: PricePusherMetrics;
      walletBalanceInfo?: WalletBalanceInfo;
    },
  ) {
    this.pushingFrequency = config.pushingFrequency;
    this.metrics = config.metrics;
    this.walletBalanceInfo = config.walletBalanceInfo;

    // Set the number of price feeds if metrics are enabled
    this.metrics?.setPriceFeedsTotal(this.priceConfigs.length);
  }

  // Get wallet balance and update metrics
  private async updateWalletBalance(): Promise<void> {
    if (!this.metrics || !this.walletBalanceInfo) return;

    try {
      const { client, address, network } = this.walletBalanceInfo;
      const balance = await client.getBalance({
        address: address,
      });

      this.metrics.updateWalletBalance(address, network, balance);
      this.logger.debug(
        `Updated wallet balance: ${address} = ${balance.toString()}`,
      );
    } catch (error) {
      this.logger.error({ error }, "Error fetching wallet balance for metrics");
    }
  }

  async start() {
    // start the listeners
    await this.sourcePriceListener.start();
    await this.targetPriceListener.start();

    // Update wallet balance initially if metrics are enabled
    if (this.metrics && this.walletBalanceInfo) {
      await this.updateWalletBalance();
    }

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

      // Update wallet balance if metrics are enabled
      if (this.metrics && this.walletBalanceInfo) {
        await this.updateWalletBalance();
      }

      for (const priceConfig of this.priceConfigs) {
        const priceId = priceConfig.id;
        const alias = priceConfig.alias;

        const targetLatestPrice =
          this.targetPriceListener.getLatestPriceInfo(priceId);
        const sourceLatestPrice =
          this.sourcePriceListener.getLatestPriceInfo(priceId);

        // Update metrics for the last published time if available
        if (this.metrics && targetLatestPrice) {
          this.metrics.updateLastPublishedTime(
            priceId,
            alias,
            targetLatestPrice,
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
              this.metrics.recordPriceUpdate(config.id, config.alias);
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
              this.metrics.recordPriceUpdateError(
                config.id,
                config.alias,
                error instanceof Error ? error.name : "unknown",
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
