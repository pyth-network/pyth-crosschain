import { KimAdapter } from "./adapter/kim";
import { SWAP_ADAPTER_CONFIGS } from "./const";
import {
  Client,
  Opportunity,
  OpportunityParams,
  ChainId,
  TokenAmount,
} from "@pythnetwork/express-relay-evm-js";
import { Adapter, ExtendedTargetCall, TargetCall } from "./types";
import { Address } from "viem";

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
    this.adapters = [new KimAdapter()];
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

  private createSwapOpportunity(
    opportunity: Opportunity,
    asset: Address,
    swapsSell: ExtendedTargetCall[],
    swapsBuy: ExtendedTargetCall[]
  ): Opportunity {
    const targetContract =
      SWAP_ADAPTER_CONFIGS[opportunity.chainId].multicallAdapter;
    const targetCallValue =
      swapsSell.reduce((prev, curr) => prev + curr.targetCallValue, 0n) +
      swapsBuy.reduce((prev, curr) => prev + curr.targetCallValue, 0n) +
      opportunity.targetCallValue;
    const targetCalldata = "0x"; // TODO: construct multicall calldata

    // TODO: extract new sellTokens and buyTokens correctly!
    const sellTokens: TokenAmount[] = [
      {
        token: asset,
        amount: swapsSell.reduce(
          (prev, curr) =>
            prev +
            curr.tokensToSend.reduce(
              (prev, curr) => prev + curr.tokenAmount.amount,
              0n
            ),
          0n
        ),
      },
    ];
    const buyTokens: TokenAmount[] = [
      {
        token: asset,
        amount: swapsBuy.reduce(
          (prev, curr) =>
            prev +
            curr.tokensToReceive.reduce((prev, curr) => prev + curr.amount, 0n),
          0n
        ),
      },
    ];

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
    asset: Address
  ): Promise<Opportunity> {
    const promisesOptimalAdaptersSell = opportunity.sellTokens.map(
      (sellToken) =>
        this.getOptimalAdapter(opportunity.chainId, asset, sellToken.token)
    );
    const promisesOptimalAdaptersBuy = opportunity.buyTokens.map((buyToken) =>
      this.getOptimalAdapter(opportunity.chainId, buyToken.token, asset)
    );

    const [optimalAdaptersSell, optimalAdaptersBuy] = await Promise.all([
      Promise.all(promisesOptimalAdaptersSell),
      Promise.all(promisesOptimalAdaptersBuy),
    ]);

    const swapsSell = optimalAdaptersSell.map((adapter, index) =>
      adapter.constructSwap(
        opportunity.chainId,
        asset,
        opportunity.sellTokens[index].token,
        undefined,
        opportunity.sellTokens[index].amount
      )
    );
    const swapsBuy = optimalAdaptersBuy.map((adapter, index) =>
      adapter.constructSwap(
        opportunity.chainId,
        opportunity.buyTokens[index].token,
        asset,
        opportunity.buyTokens[index].amount,
        undefined
      )
    );

    return this.createSwapOpportunity(opportunity, asset, swapsSell, swapsBuy);
  }

  async opportunityHandler(opportunity: Opportunity) {
    // check opportunity
    const swapAdapterConfig = getSwapAdapterConfig(opportunity.chainId);

    await Promise.all(
      swapAdapterConfig.liquidAssets.map(async (asset) => {
        const { opportunityId, ...params } = await this.convertOpportunity(
          opportunity,
          asset
        );
        await this.client.submitOpportunity(params);
      })
    );
  }
}
