import { SuperWalletClient } from "./super-wallet";
import { BaseBalanceTracker, BaseBalanceTrackerConfig } from "../interface";

/**
 * EVM-specific configuration for balance tracker
 */
export interface EvmBalanceTrackerConfig extends BaseBalanceTrackerConfig {
  /** EVM wallet client */
  client: SuperWalletClient;
  /** EVM address with 0x prefix */
  address: `0x${string}`;
}

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
