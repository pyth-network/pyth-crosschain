export type GasParams =
  | { type: "eip1559"; maxFeePerGas: number; maxPriorityFeePerGas: number }
  | { type: "legacy"; gasPrice: number };

export type PushAttempt = {
  nonce: number;
  gas: GasParams;
};
