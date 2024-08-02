import { Adapter, Pair, ExtendedTargetCall, TokenToSend } from "../types";
import { Address, Hex } from "viem";
import { TokenAmount } from "@pythnetwork/express-relay-evm-js";

export class OdosAdapter implements Adapter {
  chainIds: string[] = ["34443"];
  getPrice(chainId: string, pair: Pair): Promise<number> {
    return Promise.resolve(1);
  }
  constructSwaps(
    chainId: string,
    tokenIn: Address,
    tokenOut: Address,
    amountIn?: bigint,
    amountOut?: bigint
  ): ExtendedTargetCall[] {
    // construct the swap calldata manually
    let targetContract: Address = "0x59F78DE21a0b05d96Ae00c547BA951a3B905602f";
    let targetCalldata: Hex = "0x";
    let targetCallValue: bigint = 0n;
    let tokensToSend: TokenToSend[] = [];

    // TODO: figure out this
    let tokensToReceive: TokenAmount[] = [];

    return [
      {
        targetContract,
        targetCalldata,
        targetCallValue,
        tokensToSend,
        tokensToReceive,
      },
    ];
  }
}
