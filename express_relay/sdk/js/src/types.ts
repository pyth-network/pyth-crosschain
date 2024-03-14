import { Address, Hex } from "viem";
import type { components } from "./serverTypes";

/**
 * ERC20 token with contract address and amount
 */
export type TokenAmount = {
  token: Address;
  amount: bigint;
};
export type BidId = string;
export type ChainId = string;
/**
 * Bid parameters
 */
export type BidParams = {
  /**
   * Bid amount in wei
   */
  amount: bigint;
  /**
   * Unix timestamp for when the bid is no longer valid in seconds
   */
  validUntil: bigint;
};
/**
 * Represents a valid opportunity ready to be executed
 */
export type Opportunity = {
  /**
   * The chain id where the opportunity will be executed.
   */
  chainId: ChainId;

  /**
   * Unique identifier for the opportunity
   */
  opportunityId: string;
  /**
   * Permission key required for successful execution of the opportunity.
   */
  permissionKey: Hex;
  /**
   * Contract address to call for execution of the opportunity.
   */
  targetContract: Address;
  /**
   * Calldata for the targetContract call.
   */
  targetCalldata: Hex;
  /**
   * Value to send with the targetContract call.
   */
  targetCallValue: bigint;
  /**
   * Tokens required to repay the debt
   */
  sellTokens: TokenAmount[];
  /**
   * Tokens to receive after the opportunity is executed
   */
  buyTokens: TokenAmount[];
};
/**
 * All the parameters necessary to represent an opportunity
 */
export type OpportunityParams = Omit<Opportunity, "opportunityId">;
/**
 * Represents a bid for an opportunity
 */
export type OpportunityBid = {
  /**
   * Opportunity unique identifier in uuid format
   */
  opportunityId: string;
  /**
   * The permission key required for successful execution of the opportunity.
   */
  permissionKey: Hex;
  /**
   * Executor address
   */
  executor: Address;
  /**
   * Signature of the executor
   */
  signature: Hex;

  bid: BidParams;
};
/**
 * Represents a raw bid on acquiring a permission key
 */
export type Bid = {
  /**
   * The permission key to bid on
   * @example 0xc0ffeebabe
   *
   */
  permissionKey: Hex;
  /**
   * @description Amount of bid in wei.
   * @example 10
   */
  amount: bigint;
  /**
   * @description Calldata for the targetContract call.
   * @example 0xdeadbeef
   */
  targetCalldata: Hex;
  /**
   * @description The chain id to bid on.
   * @example sepolia
   */
  chainId: ChainId;
  /**
   * @description The targetContract address to call.
   * @example 0xcA11bde05977b3631167028862bE2a173976CA11
   */
  targetContract: Address;
};
export type BidStatusUpdate = {
  id: BidId;
} & components["schemas"]["BidStatus"];
