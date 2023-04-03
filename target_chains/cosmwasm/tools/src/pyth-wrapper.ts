import {
  ChainExecutor,
  ExecuteContractResponse,
} from "./chains-manager/chain-executor";
import { ChainQuerier } from "./chains-manager/chain-querier";

export type UpdateFeeResponse = {
  denom: string;
  amount: string;
};

export type Price = {
  price: number;
  conf: number;
  expo: number;
  publish_time: number;
};

export type PriceFeedResponse = {
  id: string;
  price: Price;
  ema_price: Price;
};

export class PythWrapperQuerier {
  constructor(private chainQuerier: ChainQuerier) {}

  // get update fee
  async getUpdateFee(
    contractAddr: string,
    vaas: string[]
  ): Promise<UpdateFeeResponse> {
    try {
      const updateFeeResponse = await this.chainQuerier.getSmartContractState({
        contractAddr,
        query: {
          get_update_fee: {
            vaas,
          },
        },
      });

      return updateFeeResponse as UpdateFeeResponse;
    } catch (e) {
      throw new Error("Error fetching update fee");
    }
  }

  // get price feed
  async getPriceFeed(
    contractAddr: string,
    id: string
  ): Promise<PriceFeedResponse> {
    try {
      const priceFeedResponse = await this.chainQuerier.getSmartContractState({
        contractAddr,
        query: {
          price_feed: {
            id,
          },
        },
      });

      return priceFeedResponse as PriceFeedResponse;
    } catch (e) {
      throw new Error("Error fetching update fee");
    }
  }
}

export type Fund = {
  denom: string;
  amount: string;
};

export type ExecuteUpdatePriceFeedsRequest = {
  contractAddr: string;
  vaas: string;
  fund: Fund;
};

export type ExecuteGovernanceInstructionRequest = {
  contractAddr: string;
  vaa: string;
};

export class PythWrapperExecutor {
  constructor(private chainExecutor: ChainExecutor) {}
  async executeUpdatePriceFeeds(
    req: ExecuteUpdatePriceFeedsRequest
  ): Promise<ExecuteContractResponse> {
    const { contractAddr, vaas, fund } = req;

    return await this.chainExecutor.executeContract({
      contractAddr: contractAddr,
      msg: {
        update_price_feeds: {
          data: vaas,
        },
      },
      funds: [fund],
    });
  }
  async executeGovernanceInstruction(
    req: ExecuteGovernanceInstructionRequest
  ): Promise<ExecuteContractResponse> {
    const { contractAddr, vaa } = req;

    return await this.chainExecutor.executeContract({
      contractAddr: contractAddr,
      msg: {
        execute_governance_instruction: {
          data: vaa,
        },
      },
    });
  }
}
