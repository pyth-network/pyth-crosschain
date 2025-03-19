import { PricePusherMetrics } from "./metrics";
import { Logger } from "pino";
import { DurationInSeconds } from "./utils";
import { IBalanceTracker } from "./interface";
import { EvmBalanceTracker } from "./evm/balance-tracker";
import { SuperWalletClient } from "./evm/super-wallet";

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

// Additional factory functions for other chains would follow the same pattern:
// export function createSuiBalanceTracker(params: CreateSuiBalanceTrackerParams): IBalanceTracker { ... }
// export function createSolanaBalanceTracker(params: CreateSolanaBalanceTrackerParams): IBalanceTracker { ... }
