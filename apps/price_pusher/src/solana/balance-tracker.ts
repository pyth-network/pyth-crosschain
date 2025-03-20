import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  BaseBalanceTracker,
  BaseBalanceTrackerConfig,
  IBalanceTracker,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { PricePusherMetrics } from "../metrics";
import { Logger } from "pino";

/**
 * Solana-specific configuration for balance tracker
 */
export interface SolanaBalanceTrackerConfig extends BaseBalanceTrackerConfig {
  /** Solana connection instance */
  connection: Connection;
  /** Solana public key */
  publicKey: PublicKey;
}

/**
 * Solana-specific implementation of the balance tracker
 */
export class SolanaBalanceTracker extends BaseBalanceTracker {
  private connection: Connection;
  private publicKey: PublicKey;

  constructor(config: SolanaBalanceTrackerConfig) {
    super({
      ...config,
      logger: config.logger.child({ module: "SolanaBalanceTracker" }),
    });

    this.connection = config.connection;
    this.publicKey = config.publicKey;
  }

  /**
   * Solana-specific implementation of balance update
   */
  protected async updateBalance(): Promise<void> {
    try {
      const balanceInLamports = await this.connection.getBalance(
        this.publicKey,
      );

      // Convert from lamports to SOL
      const balanceInSol = balanceInLamports / LAMPORTS_PER_SOL;

      this.metrics.updateWalletBalance(
        this.address,
        this.network,
        balanceInSol,
      );
      this.logger.debug(
        `Updated Solana wallet balance: ${this.address} = ${balanceInSol.toString()} SOL (${balanceInLamports} lamports)`,
      );
    } catch (error) {
      this.logger.error(
        { error },
        "Error fetching Solana wallet balance for metrics",
      );
    }
  }
}

/**
 * Parameters for creating a Solana balance tracker
 */
export interface CreateSolanaBalanceTrackerParams {
  connection: Connection;
  publicKey: PublicKey;
  network: string;
  updateInterval: DurationInSeconds;
  metrics: PricePusherMetrics;
  logger: Logger;
}

/**
 * Factory function to create a balance tracker for Solana
 */
export function createSolanaBalanceTracker(
  params: CreateSolanaBalanceTrackerParams,
): IBalanceTracker {
  return new SolanaBalanceTracker({
    connection: params.connection,
    publicKey: params.publicKey,
    address: params.publicKey.toString(),
    network: params.network,
    updateInterval: params.updateInterval,
    metrics: params.metrics,
    logger: params.logger,
  });
}
