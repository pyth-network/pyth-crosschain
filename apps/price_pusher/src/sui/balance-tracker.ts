import { SuiClient } from "@mysten/sui/client";
import type { Logger } from "pino";

import type {
  BaseBalanceTrackerConfig,
  IBalanceTracker,
} from "../interface.js";
import { BaseBalanceTracker } from "../interface.js";
import { PricePusherMetrics } from "../metrics.js";
import type { DurationInSeconds } from "../utils.js";

/**
 * Sui-specific configuration for balance tracker
 */
export type SuiBalanceTrackerConfig = {
  /** Sui client instance */
  client: SuiClient;
} & BaseBalanceTrackerConfig;

/**
 * Sui-specific implementation of the balance tracker
 */
export class SuiBalanceTracker extends BaseBalanceTracker {
  private client: SuiClient;

  constructor(config: SuiBalanceTrackerConfig) {
    super({
      ...config,
      logger: config.logger.child({ module: "SuiBalanceTracker" }),
    });

    this.client = config.client;
  }

  /**
   * Sui-specific implementation of balance update
   */
  protected async updateBalance(): Promise<void> {
    try {
      const balance = await this.client.getBalance({
        owner: this.address,
      });

      // Convert to a normalized number for reporting (SUI has 9 decimals)
      const normalizedBalance = Number(balance.totalBalance) / 1e9;

      this.metrics.updateWalletBalance(
        this.address,
        this.network,
        normalizedBalance,
      );

      this.logger.debug(
        `Updated Sui wallet balance: ${this.address} = ${normalizedBalance.toString()} SUI`,
      );
    } catch (error) {
      this.logger.error(
        { error },
        "Error fetching Sui wallet balance for metrics",
      );
    }
  }
}

/**
 * Parameters for creating a Sui balance tracker
 */
export type CreateSuiBalanceTrackerParams = {
  client: SuiClient;
  address: string;
  network: string;
  updateInterval: DurationInSeconds;
  metrics: PricePusherMetrics;
  logger: Logger;
};

/**
 * Factory function to create a balance tracker for Sui chain
 */
export function createSuiBalanceTracker(
  params: CreateSuiBalanceTrackerParams,
): IBalanceTracker {
  return new SuiBalanceTracker({
    client: params.client,
    address: params.address,
    network: params.network,
    updateInterval: params.updateInterval,
    metrics: params.metrics,
    logger: params.logger,
  });
}
