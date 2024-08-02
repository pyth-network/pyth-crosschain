import { Address, Hex } from "viem";
import { TokenAmount } from "@pythnetwork/express-relay-evm-js";

export type SwapAdapterConfig = {
  /**
   * The chain id as a u64
   */
  chainId: number;
  /**
   * The multicall adapter address
   */
  multicallAdapter: Address;
  /**
   * List of liquid assets to swap into/from
   */
  liquidAssets: Address[];
};

export type Pair = {
  token0: Address;
  token1: Address;
};

export type TokenToSend = {
  tokenAmount: TokenAmount;
  destination: Address;
};

export type TargetCall = {
  targetContract: Address;
  targetCalldata: Hex;
  targetCallValue: bigint;
  tokensToSend: TokenToSend[];
};

// TODO: better name
export type ExtendedTargetCall = TargetCall & {
  tokensToReceive: TokenAmount[];
};

export interface Adapter {
  chainIds: string[];
  getPrice: (chainId: string, pair: Pair) => Promise<number>;
  constructSwaps: (
    chainId: string,
    tokenIn: Address,
    tokenOut: Address,
    amountIn?: bigint,
    amountOut?: bigint
  ) => ExtendedTargetCall[];
}
