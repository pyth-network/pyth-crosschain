import { SuiClient } from "@mysten/sui/client";
import { BaseBalanceTracker, BaseBalanceTrackerConfig } from "../interface";

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
      // Get all coins owned by the address
      const { data: coins } = await this.client.getCoins({
        owner: this.address,
      });

      // Sum up all coin balances
      const totalBalance = coins.reduce((acc, coin) => {
        return acc + BigInt(coin.balance);
      }, BigInt(0));

      // Convert to a normalized number for reporting (SUI has 9 decimals)
      const normalizedBalance = Number(totalBalance) / 1e9;

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
