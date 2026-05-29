import type { GasPrice } from "./evm/gas-price.js";

export type PushAttempt = {
  nonce: number;
  gasPrice: GasPrice;
};
