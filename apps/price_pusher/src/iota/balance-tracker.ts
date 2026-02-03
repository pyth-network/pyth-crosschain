import { IotaClient } from "@iota/iota-sdk/client";
import type { Logger } from "pino";

import type {
  BaseBalanceTrackerConfig,
  IBalanceTracker,
} from "../interface.js";
import { BaseBalanceTracker } from "../interface.js";
import { PricePusherMetrics } from "../metrics.js";
import type { DurationInSeconds } from "../utils.js";

/**
 * Iota-specific configuration for balance tracker
 */
export type IotaBalanceTrackerConfig = {
  /** Iota client instance */
  client: IotaClient;
} & BaseBalanceTrackerConfig;

/**
 * Iota-specificimplementation of the balance tracker
 */
export class IotaBalanceTracker extends BaseBalanceTracker {
  private client: IotaClient;

  constructor(config: IotaBalanceTrackerConfig) {
    super({
      ...config,
      logger: config.logger.child({ module: "IotaBalanceTracker" }),
    });

    this.client = config.client;
  }

  /**
   * Iota-specificimplementation of balance update
   */
  protected async updateBalance(): Promise<void> {
    try {
      const balance = await this.client.getBalance({
        owner: this.address,
      });

      // Convert to a normalized number for reporting (IOTA has 9 decimals)
      const normalizedBalance = Number(balance.totalBalance) / 1e9;

      this.metrics.updateWalletBalance(
        this.address,
        this.network,
        normalizedBalance,
      );

      this.logger.debug(
        `Updated Iota wallet balance: ${this.address} = ${normalizedBalance.toString()} IOTA`,
      );
    } catch (error) {
      this.logger.error(
        { error },
        "Error fetching Iota wallet balance for metrics",
      );
    }
  }
}

/**
 * Parameters for creating an Iota balance tracker
 */
export type CreateIotaBalanceTrackerParams = {
  client: IotaClient;
  address: string;
  network: string;
  updateInterval: DurationInSeconds;
  metrics: PricePusherMetrics;
  logger: Logger;
};

/**
 * Factory function to create a balance tracker for Iota chain
 */
export function createIotaBalanceTracker(
  params: CreateIotaBalanceTrackerParams,
): IBalanceTracker {
  return new IotaBalanceTracker({
    client: params.client,
    address: params.address,
    network: params.network,
    updateInterval: params.updateInterval,
    metrics: params.metrics,
    logger: params.logger,
  });
}
