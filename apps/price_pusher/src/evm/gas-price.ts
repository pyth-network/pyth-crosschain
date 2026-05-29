import type { Logger } from "pino";

import type { CustomGasStation } from "./custom-gas-station.js";
import type { SuperWalletClient } from "./super-wallet.js";

export const gasPriceStrategies = ["eip1559", "legacy"] as const;
export type GasPriceStrategy = (typeof gasPriceStrategies)[number];

// A gas price is represented differently depending on the transaction type.
//
// - `eip1559`: The recommended model. The fee is split into the network base
//   fee (handled by the chain) and a priority fee (tip) paid to the proposer.
//   We send `maxFeePerGas` (the cap we are willing to pay including base fee)
//   and `maxPriorityFeePerGas` (the tip). This avoids relying on the
//   `eth_gasPrice` RPC which is deprecated and mishandled by some RPCs.
// - `legacy`: The deprecated single `gasPrice` model. Kept for chains that do
//   not support EIP-1559 transactions.
export type GasPrice =
  | { strategy: "legacy"; gasPrice: bigint }
  | { strategy: "eip1559"; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };

export type GasPriceConfig = {
  strategy: GasPriceStrategy;
  // eip1559: multiplier applied to the chain base fee to leave headroom for
  // base fee increases between blocks (mirrors the base fee surge in Fortuna).
  baseFeeMultiplier: number;
  // eip1559: multiplier applied to the estimated priority fee (tip).
  priorityFeeMultiplier: number;
  // legacy: override the gas price returned by the RPC (in wei).
  gasPrice?: number | undefined;
  // legacy: optional chain-specific gas station to source the gas price from.
  customGasStation?: CustomGasStation | undefined;
};

// Fetch a fresh gas price from the chain (or config overrides).
export const getGasPrice = async (
  client: SuperWalletClient,
  config: GasPriceConfig,
  logger: Logger,
): Promise<GasPrice> => {
  if (config.strategy === "legacy") {
    const gasPrice =
      config.gasPrice !== undefined
        ? BigInt(Math.ceil(config.gasPrice))
        : // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          (await config.customGasStation?.getCustomGasPrice()) ||
          (await client.getGasPrice());
    return { gasPrice, strategy: "legacy" };
  }

  // Source the fee from the chain base fee and an estimated priority fee
  // instead of the deprecated eth_gasPrice RPC (which some RPCs mishandle).
  // We pad the base fee to leave headroom for increases between blocks and
  // apply a multiplier to the priority fee, mirroring the gas model in Fortuna.
  const block = await client.getBlock({ blockTag: "latest" });
  if (block.baseFeePerGas == null) {
    throw new Error(
      "The chain does not report a base fee per gas, so it does not support " +
        "eip1559 transactions. Re-run with `--gas-pricing-strategy legacy`.",
    );
  }

  const priorityFee = scaleBigInt(
    await client.estimateMaxPriorityFeePerGas(),
    config.priorityFeeMultiplier,
  );
  const maxFeePerGas =
    scaleBigInt(block.baseFeePerGas, config.baseFeeMultiplier) + priorityFee;

  logger.debug(
    `Estimated baseFeePerGas=${block.baseFeePerGas} priorityFee=${priorityFee}`,
  );

  return {
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee,
    strategy: "eip1559",
  };
};

// Multiply every fee component by `factor` (used to bump a stuck transaction).
export const scaleGasPrice = (gasPrice: GasPrice, factor: number): GasPrice => {
  if (gasPrice.strategy === "legacy") {
    return {
      gasPrice: scaleBigInt(gasPrice.gasPrice, factor),
      strategy: "legacy",
    };
  }
  return {
    maxFeePerGas: scaleBigInt(gasPrice.maxFeePerGas, factor),
    maxPriorityFeePerGas: scaleBigInt(gasPrice.maxPriorityFeePerGas, factor),
    strategy: "eip1559",
  };
};

// The scalar that represents how much we are bidding to land the transaction.
// Used to compare two gas prices when deciding whether to override.
export const gasPriceBid = (gasPrice: GasPrice): bigint =>
  gasPrice.strategy === "legacy" ? gasPrice.gasPrice : gasPrice.maxFeePerGas;

// Pick the gas price with the higher bid (used to override a stuck tx).
export const maxGasPrice = (a: GasPrice, b: GasPrice): GasPrice =>
  gasPriceBid(a) >= gasPriceBid(b) ? a : b;

// Pick the gas price with the lower bid (used to cap an override).
export const minGasPrice = (a: GasPrice, b: GasPrice): GasPrice =>
  gasPriceBid(a) <= gasPriceBid(b) ? a : b;

// Convert to the fee fields understood by viem's transaction methods.
export const gasPriceToTxParams = (gasPrice: GasPrice) =>
  gasPrice.strategy === "legacy"
    ? { gasPrice: gasPrice.gasPrice }
    : {
        maxFeePerGas: gasPrice.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
      };

export const describeGasPrice = (gasPrice: GasPrice): string =>
  gasPrice.strategy === "legacy"
    ? `gasPrice=${gasPrice.gasPrice}`
    : `maxFeePerGas=${gasPrice.maxFeePerGas} maxPriorityFeePerGas=${gasPrice.maxPriorityFeePerGas}`;

// Scale a bigint by a floating point factor using fixed-point arithmetic to
// avoid precision loss on large wei values.
const SCALE_PRECISION = 1_000_000_000n;
const scaleBigInt = (value: bigint, factor: number): bigint =>
  (value * BigInt(Math.round(factor * Number(SCALE_PRECISION)))) /
  SCALE_PRECISION;
