import { Adapter, ExtendedTargetCall, TokenToSend } from "../types";
import { Address, Hex } from "viem";
import { TokenAmount } from "@pythnetwork/express-relay-evm-js";
import axios, { AxiosInstance } from "axios";
import { getSwapAdapterConfig } from "../index";

export class OdosAdapter implements Adapter {
  chainIds: string[] = ["34443"];
  private httpClient: AxiosInstance;
  constructor(timeout?: number) {
    this.httpClient = axios.create({
      baseURL: "https://api.odos.xyz/api",
      timeout: timeout || 5000,
    });
  }
  async getPrice(
    chainId: string,
    tokenIn: Address,
    tokenOut: Address,
    amountIn?: bigint,
    amountOut?: bigint
  ): Promise<number> {
    if (typeof amountIn === "undefined") {
      throw new Error("amountIn must be defined");
    }
    if (typeof amountOut !== "undefined") {
      throw new Error("amountOut must not be defined");
    }

    const response = await this.httpClient.get("/sor/quote/v2", {
      params: {
        chainId: chainId,
        inputTokens: [
          {
            amount: amountIn.toString(),
            tokenAddress: tokenIn,
          },
        ],
        outputTokens: [
          {
            proportion: 1,
            tokenAddress: tokenOut,
          },
        ],
        slippageLimitPercent: 0.5,
        userAddr: getSwapAdapterConfig(chainId).multicallAdapter,
      },
    });
    return response.data.outTokens[0] / response.data.inTokens[0];
  }
  async constructSwaps(
    chainId: string,
    tokenIn: Address,
    tokenOut: Address,
    amountIn?: bigint,
    amountOut?: bigint
  ): Promise<ExtendedTargetCall[]> {
    if (typeof amountIn === "undefined") {
      throw new Error("amountIn must be defined");
    }

    const responseQuote = await this.httpClient.get("/sor/quote/v2", {
      params: {
        chainId: chainId,
        inputTokens: [
          {
            amount: amountIn.toString(),
            tokenAddress: tokenIn,
          },
        ],
        outputTokens: [
          {
            proportion: 1,
            tokenAddress: tokenOut,
          },
        ],
        slippageLimitPercent: 0.5,
        userAddr: getSwapAdapterConfig(chainId).multicallAdapter,
      },
    });
    if (typeof amountOut !== "undefined") {
      if (responseQuote.data.outTokens[0] < amountOut) {
        throw new Error("Not enough output tokens");
      }
    }
    const pathId = responseQuote.data.pathId;

    const responseTx = await this.httpClient.get("/sor/assemble", {
      params: {
        pathId: pathId,
        simulate: false,
        userAddr: getSwapAdapterConfig(chainId).multicallAdapter,
      },
    });
    const targetCalldata: Hex = responseTx.data.transaction.data;
    const targetContract: Address = responseTx.data.transaction.to;
    const targetCallValue: bigint = BigInt(responseTx.data.transaction.value);

    const tokensToSend: TokenToSend[] = responseTx.data.inputTokens.map(
      (inputToken: { tokenAddress: Address; amount: string }) => ({
        tokenAmount: {
          token: inputToken.tokenAddress as Address,
          amount: inputToken.amount,
        },
        destination: responseTx.data.transaction.to,
      })
    );
    const tokensToReceive: TokenAmount[] = responseTx.data.outputTokens.map(
      (outputToken: { tokenAddress: Address; amount: string }) => ({
        token: outputToken.tokenAddress as Address,
        amount: outputToken.amount,
      })
    );

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
