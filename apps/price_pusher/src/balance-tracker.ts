import { PricePusherMetrics } from "./metrics";
import { Logger } from "pino";
import { DurationInSeconds } from "./utils";
import { IBalanceTracker } from "./interface";
import { EvmBalanceTracker } from "./evm/balance-tracker";
import { SuperWalletClient } from "./evm/super-wallet";
import { AptosBalanceTracker } from "./aptos/balance-tracker";
import { SuiBalanceTracker } from "./sui/balance-tracker";
import { SuiClient } from "@mysten/sui/client";

/**
 * Parameters for creating an EVM balance tracker
 */
export interface CreateEvmBalanceTrackerParams {
  client: SuperWalletClient;
  address: `0x${string}`;
  network: string;
  updateInterval: DurationInSeconds;
  metrics: PricePusherMetrics;
  logger: Logger;
}

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

// Additional factory functions for other chains would follow the same pattern:
// export function createSolanaBalanceTracker(params: CreateSolanaBalanceTrackerParams): IBalanceTracker { ... }
