import { OdosAdapter } from "./adapter/odos";
import { SWAP_ADAPTER_CONFIGS } from "./const";
import {
  Client,
  Opportunity,
  OpportunityParams,
  ChainId,
  TokenAmount,
  OPPORTUNITY_ADAPTER_CONFIGS,
} from "@pythnetwork/express-relay-evm-js";
import { Adapter, ExtendedTargetCall, TargetCall } from "./types";
import { Address, Hex, encodeFunctionData } from "viem";
import { multicallAbi } from "./abi";

export class SwapBeaconError extends Error {}

function getSwapAdapterConfig(chainId: string) {
  const swapAdapterConfig = SWAP_ADAPTER_CONFIGS[chainId];
  if (!swapAdapterConfig) {
    throw new SwapBeaconError(
      `Opportunity adapter config not found for chain id: ${chainId}`
    );
  }
  return swapAdapterConfig;
}

export class SwapBeacon {
  private client: Client;
  private adapters: Adapter[];

  constructor(public endpoint: string) {
    this.client = new Client(
      {
        baseUrl: endpoint,
      },
      undefined,
      this.opportunityHandler.bind(this)
    );
    this.adapters = [new OdosAdapter()];
  }

  private async getOptimalAdapter(
    chainId: ChainId,
    tokenIn: Address,
    tokenOut: Address
  ) {
    const pair = {
      token0: tokenIn,
      token1: tokenOut,
    };
    const prices = await Promise.all(
      this.adapters.map((adapter) => adapter.getPrice(chainId, pair))
    );

    return this.adapters[
      prices.reduce(
        (prev, curr, currIndex) => (prices[prev] < curr ? currIndex : prev),
        0
      )
    ];
  }

  private makeMulticallCalldata(
    opportunity: Opportunity,
    swapsSell: ExtendedTargetCall[],
    swapsBuy: ExtendedTargetCall[],
    sellTokens: TokenAmount[],
    buyTokens: TokenAmount[]
  ): Hex {
    const originalTargetCall = {
      targetContract: opportunity.targetContract,
      targetCalldata: opportunity.targetCalldata,
      targetCallValue: opportunity.targetCallValue,
      tokensToSend: opportunity.sellTokens.map((token) => ({
        tokenAmount: token,
        destination: opportunity.targetContract,
      })),
    };
    const swapsSellTargetCalls = swapsSell.map((swap) => ({
      targetContract: swap.targetContract,
      targetCalldata: swap.targetCalldata,
      targetCallValue: swap.targetCallValue,
      tokensToSend: swap.tokensToSend,
    }));
    const swapsBuyTargetCalls = swapsBuy.map((swap) => ({
      targetContract: swap.targetContract,
      targetCalldata: swap.targetCalldata,
      targetCallValue: swap.targetCallValue,
      tokensToSend: swap.tokensToSend,
    }));
    const multicallTargetCalls = [
      ...swapsSellTargetCalls,
      originalTargetCall,
      ...swapsBuyTargetCalls,
    ];

    return encodeFunctionData({
      abi: [multicallAbi],
      args: [[sellTokens, buyTokens, multicallTargetCalls]],
    });
  }

  private extractTokenAmounts(
    extendedTargetCall: ExtendedTargetCall[]
  ): [TokenAmount[], TokenAmount[]] {
    let inputsAll: Record<Address, bigint> = {};
    let outputsAll: Record<Address, bigint> = {};

    for (let call of extendedTargetCall) {
      call.tokensToSend.forEach((tokenToSend) => {
        const token = tokenToSend.tokenAmount.token;
        let amount = tokenToSend.tokenAmount.amount;

        if (token in outputsAll) {
          const deduction = Math.min(Number(outputsAll[token]), Number(amount));
          outputsAll[token] -= BigInt(deduction);
          amount -= BigInt(deduction);

          if (outputsAll[token] === 0n) {
            delete outputsAll[token];
          }
        }

        if (amount > 0n) {
          inputsAll[token] = amount;
        }
      });

      call.tokensToReceive.forEach((tokenToReceive) => {
        const token = tokenToReceive.token;
        const amount = tokenToReceive.amount;

        if (token in outputsAll) {
          outputsAll[token] += amount;
        } else {
          outputsAll[token] = amount;
        }
      });
    }

    const inputsTokenAmount: TokenAmount[] = Object.entries(inputsAll).map(
      ([token, amount]) => ({ token: token as Address, amount: amount })
    );
    const outputsTokenAmount: TokenAmount[] = Object.entries(outputsAll).map(
      ([token, amount]) => ({ token: token as Address, amount: amount })
    );

    return [inputsTokenAmount, outputsTokenAmount];
  }

  private createSwapOpportunity(
    opportunity: Opportunity,
    base: Address,
    swapsSell: ExtendedTargetCall[],
    swapsBuy: ExtendedTargetCall[]
  ): Opportunity {
    const targetContract =
      SWAP_ADAPTER_CONFIGS[opportunity.chainId].multicallAdapter;
    const targetCallValue =
      swapsSell.reduce((prev, curr) => prev + curr.targetCallValue, 0n) +
      swapsBuy.reduce((prev, curr) => prev + curr.targetCallValue, 0n) +
      opportunity.targetCallValue;

    const sellTokens: TokenAmount[] = this.extractTokenAmounts(swapsSell)[0];
    const buyTokens: TokenAmount[] = this.extractTokenAmounts(swapsBuy)[1];

    const targetCalldata = this.makeMulticallCalldata(
      opportunity,
      swapsSell,
      swapsBuy,
      sellTokens,
      buyTokens
    );

    return {
      ...opportunity,
      targetContract,
      targetCalldata,
      targetCallValue,
      sellTokens,
      buyTokens,
    };
  }

  async convertOpportunity(
    opportunity: Opportunity,
    base: Address
  ): Promise<Opportunity> {
    const promisesOptimalAdaptersSell = opportunity.sellTokens.map(
      (sellToken) =>
        this.getOptimalAdapter(opportunity.chainId, base, sellToken.token)
    );
    const promisesOptimalAdaptersBuy = opportunity.buyTokens.map((buyToken) =>
      this.getOptimalAdapter(opportunity.chainId, buyToken.token, base)
    );

    const [optimalAdaptersSell, optimalAdaptersBuy] = await Promise.all([
      Promise.all(promisesOptimalAdaptersSell),
      Promise.all(promisesOptimalAdaptersBuy),
    ]);

    const swapsSell = optimalAdaptersSell
      .map((adapter, index) =>
        adapter.constructSwaps(
          opportunity.chainId,
          base,
          opportunity.sellTokens[index].token,
          undefined,
          opportunity.sellTokens[index].amount
        )
      )
      .reduce((acc, val) => acc.concat(val), []);
    const swapsBuy = optimalAdaptersBuy
      .map((adapter, index) =>
        adapter.constructSwaps(
          opportunity.chainId,
          opportunity.buyTokens[index].token,
          base,
          opportunity.buyTokens[index].amount,
          undefined
        )
      )
      .reduce((acc, val) => acc.concat(val), []);

    return this.createSwapOpportunity(opportunity, base, swapsSell, swapsBuy);
  }

  async opportunityHandler(opportunity: Opportunity) {
    // check opportunity
    const swapAdapterConfig = getSwapAdapterConfig(opportunity.chainId);

    await Promise.all(
      swapAdapterConfig.liquidAssets.map(async (base) => {
        const { opportunityId, ...params } = await this.convertOpportunity(
          opportunity,
          base
        );
        await this.client.submitOpportunity(params);
      })
    );
  }
}
