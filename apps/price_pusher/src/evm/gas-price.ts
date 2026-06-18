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

// Combine a freshly-fetched gas price with the (already escalated) gas price of
// a stuck transaction so the stuck transaction can be replaced.
//
// For legacy, the single gasPrice is raised to at least the escalated value and
// bounded at the fresh value scaled by `cap`.
//
// For eip1559, nodes (e.g. Geth) require *both* maxFeePerGas and
// maxPriorityFeePerGas to increase (typically by >=10%) for a replacement to be
// accepted, so the priority fee must be escalated independently rather than
// only bumping the larger maxFeePerGas. We cap the total spend via maxFeePerGas
// (fresh maxFeePerGas scaled by `cap`) and raise the tip enough to outbid the
// stuck tx, bounding it only by that capped maxFeePerGas — bounding the tip by
// the fresh tip scaled by `cap` would stall escalation whenever the market tip
// drops, leaving the replacement underpriced.
export const escalateGasPrice = (
  fresh: GasPrice,
  escalated: GasPrice,
  cap: number,
): GasPrice => {
  // The strategy is fixed for the lifetime of the pusher, so fresh and escalated
  // always share it. The guards keep the discriminated union narrow.
  if (fresh.strategy === "legacy" && escalated.strategy === "legacy") {
    return {
      gasPrice: capComponent(fresh.gasPrice, escalated.gasPrice, cap),
      strategy: "legacy",
    };
  }
  if (fresh.strategy === "eip1559" && escalated.strategy === "eip1559") {
    // Cap the total spend via maxFeePerGas. The priority fee (tip) only needs
    // to be raised enough to outbid the stuck tx; it is bounded by the capped
    // maxFeePerGas (the EIP-1559 invariant priority <= maxFee), NOT by the fresh
    // tip scaled by `cap` — when the market tip drops, that would stop the tip
    // from escalating and leave the replacement underpriced.
    const maxFeePerGas = capComponent(
      fresh.maxFeePerGas,
      escalated.maxFeePerGas,
      cap,
    );
    const bumpedPriority = maxBigInt(
      escalated.maxPriorityFeePerGas,
      fresh.maxPriorityFeePerGas,
    );
    return {
      maxFeePerGas,
      maxPriorityFeePerGas: minBigInt(bumpedPriority, maxFeePerGas),
      strategy: "eip1559",
    };
  }
  return fresh;
};

// Raise `fresh` to at least `escalated`, but never above `fresh * cap`.
const capComponent = (fresh: bigint, escalated: bigint, cap: number): bigint =>
  minBigInt(maxBigInt(escalated, fresh), scaleBigInt(fresh, cap));

const maxBigInt = (a: bigint, b: bigint): bigint => (a > b ? a : b);
const minBigInt = (a: bigint, b: bigint): bigint => (a < b ? a : b);

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
