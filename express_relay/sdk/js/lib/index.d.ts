import type { components } from "./serverTypes";
import { ClientOptions as FetchClientOptions } from "openapi-fetch";
import { Address, Hex } from "viem";
import WebSocket from "isomorphic-ws";
import {
  Bid,
  BidId,
  BidParams,
  BidsResponse,
  BidStatusUpdate,
  BidSvm,
  ExpressRelaySvmConfig,
  Opportunity,
  OpportunityBid,
  OpportunityEvm,
  OpportunityCreate,
  TokenAmount,
} from "./types";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
export * from "./types";
export * from "./const";
export declare class ClientError extends Error {}
type ClientOptions = FetchClientOptions & {
  baseUrl: string;
  apiKey?: string;
};
export interface WsOptions {
  /**
   * Max time to wait for a response from the server in milliseconds
   */
  response_timeout: number;
}
export declare function checkHex(hex: string): Hex;
export declare function checkAddress(address: string): Address;
export declare function checkTokenQty(token: {
  token: string;
  amount: string;
}): TokenAmount;
export declare class Client {
  clientOptions: ClientOptions;
  wsOptions: WsOptions;
  websocket?: WebSocket;
  idCounter: number;
  callbackRouter: Record<
    string,
    (response: components["schemas"]["ServerResultMessage"]) => void
  >;
  private websocketOpportunityCallback?;
  private websocketBidStatusCallback?;
  private getAuthorization;
  constructor(
    clientOptions: ClientOptions,
    wsOptions?: WsOptions,
    opportunityCallback?: (opportunity: Opportunity) => Promise<void>,
    bidStatusCallback?: (statusUpdate: BidStatusUpdate) => Promise<void>,
  );
  private connectWebsocket;
  /**
   * Subscribes to the specified chains
   *
   * The opportunity handler will be called for opportunities on the specified chains
   * If the opportunity handler is not set, an error will be thrown
   * @param chains
   */
  subscribeChains(chains: string[]): Promise<void>;
  /**
   * Unsubscribes from the specified chains
   *
   * The opportunity handler will no longer be called for opportunities on the specified chains
   * @param chains
   */
  unsubscribeChains(chains: string[]): Promise<void>;
  requestViaWebsocket(
    msg: components["schemas"]["ClientMessage"],
  ): Promise<components["schemas"]["APIResponse"] | null>;
  /**
   * Fetches opportunities
   * @param chainId Chain id to fetch opportunities for. e.g: sepolia
   * @returns List of opportunities
   */
  getOpportunities(chainId?: string): Promise<Opportunity[]>;
  /**
   * Submits an opportunity to be exposed to searchers
   * @param opportunity Opportunity to submit
   */
  submitOpportunity(opportunity: OpportunityCreate): Promise<void>;
  /**
   * Submits a raw bid for a permission key
   * @param bid
   * @param subscribeToUpdates If true, the client will subscribe to bid status updates via websocket and will call the bid status callback if set
   * @returns The id of the submitted bid, you can use this id to track the status of the bid
   */
  submitBid(bid: Bid, subscribeToUpdates?: boolean): Promise<BidId>;
  /**
   * Get bids for an api key
   * @param fromTime The datetime to fetch bids from. If undefined or null, fetches from the beginning of time.
   * @returns The paginated bids response
   */
  getBids(fromTime?: Date): Promise<BidsResponse>;
  private toServerBid;
  /**
   * Converts an opportunity from the server to the client format
   * Returns undefined if the opportunity version is not supported
   * @param opportunity
   * @returns Opportunity in the converted client format
   */
  convertOpportunity(
    opportunity: components["schemas"]["Opportunity"],
  ): Opportunity | undefined;
  /**
   * Creates a signed opportunity bid for an opportunity
   * @param opportunity EVM Opportunity to bid on
   * @param bidParams Bid amount and valid until timestamp
   * @param privateKey Private key to sign the bid with
   * @returns Signed opportunity bid
   */
  signOpportunityBid(
    opportunity: OpportunityEvm,
    bidParams: BidParams,
    privateKey: Hex,
  ): Promise<OpportunityBid>;
  /**
   * Creates a signed bid for an EVM opportunity
   * @param opportunity EVM Opportunity to bid on
   * @param bidParams Bid amount, nonce, and deadline timestamp
   * @param privateKey Private key to sign the bid with
   * @returns Signed bid
   */
  signBid(
    opportunity: OpportunityEvm,
    bidParams: BidParams,
    privateKey: Hex,
  ): Promise<Bid>;
  /**
   * Creates a signature for the bid and opportunity
   * @param opportunity EVM Opportunity to bid on
   * @param bidParams Bid amount, nonce, and deadline timestamp
   * @param privateKey Private key to sign the bid with
   * @returns Signature for the bid and opportunity
   */
  getSignature(
    opportunity: OpportunityEvm,
    bidParams: BidParams,
    privateKey: Hex,
  ): Promise<`0x${string}`>;
  /**
   * Fetches the Express Relay SVM config necessary for bidding
   * @param chainId The id for the chain you want to fetch the config for
   * @param connection The connection to use for fetching the config
   */
  getExpressRelaySvmConfig(
    chainId: string,
    connection: Connection,
  ): Promise<ExpressRelaySvmConfig>;
  /**
   * Constructs a SubmitBid instruction, which can be added to a transaction to permission it on the given permission key
   * @param searcher The address of the searcher that is submitting the bid
   * @param router The identifying address of the router that the permission key is for
   * @param permissionKey The 32-byte permission key as an SVM PublicKey
   * @param bidAmount The amount of the bid in lamports
   * @param deadline The deadline for the bid in seconds since Unix epoch
   * @param chainId The chain ID as a string, e.g. "solana"
   * @param relayerSigner The address of the relayer that is submitting the bid
   * @param feeReceiverRelayer The fee collection address of the relayer
   * @returns The SubmitBid instruction
   */
  constructSubmitBidInstruction(
    searcher: PublicKey,
    router: PublicKey,
    permissionKey: PublicKey,
    bidAmount: anchor.BN,
    deadline: anchor.BN,
    chainId: string,
    relayerSigner: PublicKey,
    feeReceiverRelayer: PublicKey,
  ): Promise<TransactionInstruction>;
  /**
   * Constructs an SVM bid, by adding a SubmitBid instruction to a transaction
   * @param tx The transaction to add a SubmitBid instruction to. This transaction should already check for the appropriate permissions.
   * @param searcher The address of the searcher that is submitting the bid
   * @param router The identifying address of the router that the permission key is for
   * @param permissionKey The 32-byte permission key as an SVM PublicKey
   * @param bidAmount The amount of the bid in lamports
   * @param deadline The deadline for the bid in seconds since Unix epoch
   * @param chainId The chain ID as a string, e.g. "solana"
   * @param relayerSigner The address of the relayer that is submitting the bid
   * @param feeReceiverRelayer The fee collection address of the relayer
   * @returns The constructed SVM bid
   */
  constructSvmBid(
    tx: Transaction,
    searcher: PublicKey,
    router: PublicKey,
    permissionKey: PublicKey,
    bidAmount: anchor.BN,
    deadline: anchor.BN,
    chainId: string,
    relayerSigner: PublicKey,
    feeReceiverRelayer: PublicKey,
  ): Promise<BidSvm>;
}
//# sourceMappingURL=index.d.ts.map
