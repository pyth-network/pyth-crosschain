import { AptosClient } from "aptos";
import {
  BaseBalanceTracker,
  BaseBalanceTrackerConfig,
  IBalanceTracker,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { PricePusherMetrics } from "../metrics";
import { Logger } from "pino";

/**
 * Aptos-specific configuration for balance tracker
 */
export interface AptosBalanceTrackerConfig extends BaseBalanceTrackerConfig {
  /** Aptos node endpoint URL */
  endpoint: string;
  /** Aptos account address */
  address: string;
  /** Optional decimal places for APT token (default: 8) */
  decimals?: number;
}

/**
 * Aptos-specific implementation of the balance tracker
 */
export class AptosBalanceTracker extends BaseBalanceTracker {
  private client: AptosClient;
  private aptosAddress: string;
  private decimals: number;

  constructor(config: AptosBalanceTrackerConfig) {
    super({
      ...config,
      logger: config.logger.child({ module: "AptosBalanceTracker" }),
    });

    this.client = new AptosClient(config.endpoint);
    this.aptosAddress = config.address;
    // APT has 8 decimal places by default
    this.decimals = config.decimals ?? 8;
  }

  /**
   * Aptos-specific implementation of balance update
   * Fetches the native APT balance for the configured address
   */
  protected async updateBalance(): Promise<void> {
    try {
      // Get account resource to check the balance
      const accountResource = await this.client.getAccountResource(
        this.aptosAddress,
        "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
      );

      // Extract the balance value from the account resource
      const rawBalance = (accountResource.data as any).coin.value;

      // Convert the balance to a bigint
      const balance = BigInt(rawBalance);

      // Calculate the normalized balance for display
      const normalizedBalance = Number(balance) / Math.pow(10, this.decimals);

      // Update metrics with the new balance
      this.metrics.updateWalletBalance(
        this.address,
        this.network,
        normalizedBalance,
      );

      this.logger.debug(
        `Updated Aptos wallet balance: ${this.address} = ${normalizedBalance.toString()} APT (raw: ${balance.toString()})`,
      );
    } catch (error) {
      this.logger.error(
        { error },
        "Error fetching Aptos wallet balance for metrics",
      );
    }
  }
}

/**
 * Parameters for creating an Aptos balance tracker
 */
export interface CreateAptosBalanceTrackerParams {
  endpoint: string;
  address: string;
  network: string;
  updateInterval: DurationInSeconds;
  metrics: PricePusherMetrics;
  logger: Logger;
  decimals?: number;
}

/**
 * Factory function to create a balance tracker for Aptos chain
 */
export function createAptosBalanceTracker(
  params: CreateAptosBalanceTrackerParams,
): IBalanceTracker {
  return new AptosBalanceTracker({
    endpoint: params.endpoint,
    address: params.address,
    network: params.network,
    updateInterval: params.updateInterval,
    metrics: params.metrics,
    logger: params.logger,
    decimals: params.decimals,
  });
}
