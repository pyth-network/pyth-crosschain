import { Coin } from "@cosmjs/stargate";
import {
  ChainExecutor,
  ExecuteContractResponse,
} from "./chains-manager/chain-executor";
import { ChainQuerier } from "./chains-manager/chain-querier";

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

/**
 * `PythWrapperQuerier` wraps the ChainQuerier which can be a querier for any cosmwasm chain.
 * The ChainQuerier is contract independent, and it doesn't work with pyth specific objects which we know of.
 *
 * `PythWrapperQuerier` uses the ChainQuerier to query Pyth contracts but it works with Pyth specific objects
 */
export class PythWrapperQuerier {
  constructor(private chainQuerier: ChainQuerier) {}

  /**
   * Get the fee required to update the Pyth on-chain contract with the given VAAs.
   * This function will invoke the corresponding function on the contract itself and
   * return the result. The result is represented as both a quantity of tokens and a
   * denomination which may vary depending on the chain being queried.
   *
   * @throws an error if it fails
   */
  async getUpdateFee(contractAddr: string, vaas: string[]): Promise<Coin> {
    try {
      const updateFeeResponse = await this.chainQuerier.getSmartContractState({
        contractAddr,
        query: {
          get_update_fee: {
            vaas,
          },
        },
      });

      return updateFeeResponse as Coin;
    } catch (e) {
      throw new Error("Error fetching update fee");
    }
  }

  /**
   * Get the price feed stored in the Pyth on-chain contract with the given id.
   * This function will invoke the corresponding function on the contract itself and
   * return the result.
   *
   * It returns the PriceFeedResponse. See {@link PriceFeedResponse}
   *
   * @throws an error if it fails
   */
  async getPriceFeed(
    contractAddr: string,
    id: string,
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

      return (priceFeedResponse as any).price_feed as PriceFeedResponse;
    } catch (e) {
      throw new Error("Error fetching update fee");
    }
  }
}

export type ExecuteUpdatePriceFeedsRequest = {
  contractAddr: string;
  vaas: string[];
  fund: Coin;
};

export type ExecuteGovernanceInstructionRequest = {
  contractAddr: string;
  vaa: string;
};

/**
 * `PythWrapperExecutor` wraps the ChainExecutor which can be a executor for any cosmwasm chain.
 * The ChainExecutor is contract independent, and it doesn't work with pyth specific objects which we know of.
 *
 * `PythWrapperExecutor` uses the ChainExecutor to execute Pyth contracts but it works with Pyth specific objects
 */
export class PythWrapperExecutor {
  constructor(private chainExecutor: ChainExecutor) {}

  /**
   * Update the price feed stored in Pyth Contracts on chain. This function will send an execute request
   * to the Pyth contracts with the funds required to update a price feed.
   *
   * @param {ExecuteUpdatePriceFeedsRequest} req
   * @param {string} req.contractAddr
   * @param {string[]} req.vaas - The vaas for the price feed update
   * @param {Coin} req.fund - Update fee

   * @returns {ExecuteContractResponse} - The broadcasted transaction hash.
   *
   * @throws an error if it fails
   */
  async executeUpdatePriceFeeds(
    req: ExecuteUpdatePriceFeedsRequest,
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

  /**
   * Execute the governance instruction on Pyth contracts on chain for the given VAA.
   *
   * @param {ExecuteGovernanceInstructionRequest} req
   * @param {string} req.contractAddr
   * @param {string} req.vaa - The govenance instruction vaa.

   * @returns {ExecuteContractResponse} - The broadcasted transaction hash.
   *
   * @throws an error if it fails
   */
  async executeGovernanceInstruction(
    req: ExecuteGovernanceInstructionRequest,
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
