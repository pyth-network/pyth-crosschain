import { Address, Hex } from "viem";
import type { components } from "./serverTypes";
import { Blockhash, PublicKey, Transaction } from "@solana/web3.js";
import { OrderStateAndAddress } from "@kamino-finance/limo-sdk/dist/utils";

/**
 * ERC20 token with contract address and amount
 */
export type TokenAmount = {
  token: Address;
  amount: bigint;
};
/**
 * TokenPermissions struct for permit2
 */
export type TokenPermissions = {
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
   * Bid nonce, used to prevent replay of a submitted signature.
   * This can be set to a random uint256 when creating a new signature
   */
  nonce: bigint;
  /**
   * Unix timestamp for when the bid is no longer valid in seconds
   */
  deadline: bigint;
};

export type OpportunityAdapterConfig = {
  /**
   * The chain id as a u64
   */
  chain_id: number;
  /**
   * The opportunity factory address
   */
  opportunity_adapter_factory: Address;
  /**
   * The hash of the bytecode used to initialize the opportunity adapter
   */
  opportunity_adapter_init_bytecode_hash: Hex;
  /**
   * The permit2 address
   */
  permit2: Address;
  /**
   * The weth address
   */
  weth: Address;
};
/**
 * Represents a valid opportunity ready to be executed
 */
export type OpportunityEvm = {
  /**
   * The chain id where the opportunity will be executed.
   */
  chainId: ChainId;

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
   * Tokens required to execute the opportunity
   */
  sellTokens: TokenAmount[];
  /**
   * Tokens to receive after the opportunity is executed
   */
  buyTokens: TokenAmount[];
  /**
   * Unique identifier for the opportunity
   */
  opportunityId: string;
};

export type OpportunitySvm = {
  order: OrderStateAndAddress;
  program: "limo";
  /**
   * The chain id where the opportunity will be executed.
   */
  chainId: ChainId;
  /**
   * Slot where the opportunity was found
   */
  slot: number;
  /**
   * Blockhash that can be used to sign transactions for this opportunity
   */
  blockHash: Blockhash;
  /**
   * Unique identifier for the opportunity
   */
  opportunityId: string;
};

export type OpportunityCreate =
  | Omit<OpportunityEvm, "opportunityId">
  | Omit<OpportunitySvm, "opportunityId">;

export type Opportunity = OpportunityEvm | OpportunitySvm;
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
 * All the parameters necessary to represent an opportunity
 */

export type Bid = BidEvm | BidSvm;
/**
 * Represents a raw EVM bid on acquiring a permission key
 */
export type BidEvm = {
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
  /**
   * @description The execution environment for the bid.
   */
  env: "evm";
};

/**
 * Necessary accounts for submitting a SVM bid. These can be fetched from on-chain program data.
 */
export type ExpressRelaySvmConfig = {
  /**
   * @description The relayer signer account. All submitted transactions will be signed by this account.
   */
  relayerSigner: PublicKey;
  /**
   * @description The fee collection account for the relayer.
   */
  feeReceiverRelayer: PublicKey;
};

/**
 * Represents a raw SVM bid on acquiring a permission key
 */
export type BidSvm = {
  /**
   * @description Transaction object.
   * @example SGVsbG8sIFdvcmxkIQ
   */
  transaction: Transaction;
  /**
   * @description The chain id to bid on.
   * @example solana
   */
  chainId: ChainId;
  /**
   * @description The execution environment for the bid.
   */
  env: "svm";
};
export type BidStatusUpdate = {
  id: BidId;
} & components["schemas"]["BidStatus"];

export type BidStatusUpdateSvm = {
  id: BidId;
} & components["schemas"]["BidStatusSvm"];

export type BidStatusUpdateEvm = {
  id: BidId;
} & components["schemas"]["BidStatusEvm"];

export type BidResponse = components["schemas"]["SimulatedBid"];
export type BidResponseSvm = components["schemas"]["SimulatedBidSvm"];
export type BidResponseEvm = components["schemas"]["SimulatedBidEvm"];

export type BidsResponse = {
  items: BidResponse[];
};

export type SvmConstantsConfig = {
  expressRelayProgram: PublicKey;
};
