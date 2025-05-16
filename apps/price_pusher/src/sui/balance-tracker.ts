import { SuiClient } from "@mysten/sui/client";
import {
  BaseBalanceTracker,
  BaseBalanceTrackerConfig,
  IBalanceTracker,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { PricePusherMetrics } from "../metrics";
import { Logger } from "pino";

/**
 * Sui-specific configuration for balance tracker
 */
export interface SuiBalanceTrackerConfig extends BaseBalanceTrackerConfig {
  /** Sui client instance */
  client: SuiClient;
}

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
        `Updated Sui wallet balance: ${this.address} = ${normalizedBalance} SUI`,
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
export interface CreateSuiBalanceTrackerParams {
  client: SuiClient;
  address: string;
  network: string;
  updateInterval: DurationInSeconds;
  metrics: PricePusherMetrics;
  logger: Logger;
}

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
