import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { Logger } from "pino";

import type {
  BaseBalanceTrackerConfig,
  IBalanceTracker,
} from "../interface.js";
import { BaseBalanceTracker } from "../interface.js";
import type { PricePusherMetrics } from "../metrics.js";
import type { DurationInSeconds } from "../utils.js";

/**
 * Sui-specific configuration for balance tracker
 */
export type SuiBalanceTrackerConfig = {
  /** Sui client instance (JSON-RPC or gRPC) */
  client: ClientWithCoreApi;
} & BaseBalanceTrackerConfig;

/**
 * Sui-specific implementation of the balance tracker
 */
export class SuiBalanceTracker extends BaseBalanceTracker {
  private client: ClientWithCoreApi;

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
      const { balance } = await this.client.core.getBalance({
        owner: this.address,
      });

      // Convert to a normalized number for reporting (SUI has 9 decimals)
      const normalizedBalance = Number(balance.balance) / 1e9;

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
  client: ClientWithCoreApi;
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
    address: params.address,
    client: params.client,
    logger: params.logger,
    metrics: params.metrics,
    network: params.network,
    updateInterval: params.updateInterval,
  });
}
