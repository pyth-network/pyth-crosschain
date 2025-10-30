import type { Logger } from "pino";

import type { SuperWalletClient } from "./super-wallet.js";
import type {
  BaseBalanceTrackerConfig,
  IBalanceTracker,
} from "../interface.js";
import { BaseBalanceTracker } from "../interface.js";
import { PricePusherMetrics } from "../metrics.js";
import type { DurationInSeconds } from "../utils.js";

/**
 * EVM-specific configuration for balance tracker
 */
export type EvmBalanceTrackerConfig = {
  /** EVM wallet client */
  client: SuperWalletClient;
  /** EVM address with 0x prefix */
  address: `0x${string}`;
} & BaseBalanceTrackerConfig;

/**
 * EVM-specific implementation of the balance tracker
 */
export class EvmBalanceTracker extends BaseBalanceTracker {
  private client: SuperWalletClient;
  private evmAddress: `0x${string}`;

  constructor(config: EvmBalanceTrackerConfig) {
    super({
      ...config,
      logger: config.logger.child({ module: "EvmBalanceTracker" }),
    });

    this.client = config.client;
    this.evmAddress = config.address;
  }

  /**
   * EVM-specific implementation of balance update
   */
  protected async updateBalance(): Promise<void> {
    try {
      const balance = await this.client.getBalance({
        address: this.evmAddress,
      });

      this.metrics.updateWalletBalance(this.address, this.network, balance);
      this.logger.debug(
        `Updated EVM wallet balance: ${this.address} = ${balance.toString()}`,
      );
    } catch (error) {
      this.logger.error(
        { error },
        "Error fetching EVM wallet balance for metrics",
      );
    }
  }
}

/**
 * Parameters for creating an EVM balance tracker
 */
export type CreateEvmBalanceTrackerParams = {
  client: SuperWalletClient;
  address: `0x${string}`;
  network: string;
  updateInterval: DurationInSeconds;
  metrics: PricePusherMetrics;
  logger: Logger;
};

/**
 * Factory function to create a balance tracker for EVM chains
 */
export function createEvmBalanceTracker(
  params: CreateEvmBalanceTrackerParams,
): IBalanceTracker {
  return new EvmBalanceTracker({
    client: params.client,
    address: params.address,
    network: params.network,
    updateInterval: params.updateInterval,
    metrics: params.metrics,
    logger: params.logger,
  });
}
