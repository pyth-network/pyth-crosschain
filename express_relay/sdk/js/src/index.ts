import type { paths, components } from "./types";
import createClient, {
  ClientOptions as FetchClientOptions,
} from "openapi-fetch";
import {
  Address,
  encodeAbiParameters,
  Hex,
  isAddress,
  isHex,
  keccak256,
} from "viem";
import { privateKeyToAccount, sign, signatureToHex } from "viem/accounts";
import WebSocket from "isomorphic-ws";

export class ClientError extends Error {}

/**
 * ERC20 token with contract address and amount
 */
export type TokenQty = {
  contract: Address;
  amount: bigint;
};

export type BidId = string;
export type ChainId = string;

/**
 * Bid information
 */
export type BidInfo = {
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
 * All the parameters necessary to represent a liquidation opportunity
 */
export type Opportunity = {
  /**
   * The chain id where the liquidation will be executed.
   */
  chainId: ChainId;

  /**
   * Unique identifier for the opportunity
   */
  opportunityId: string;
  /**
   * Permission key required for succesful execution of the liquidation.
   */
  permissionKey: Hex;
  /**
   * Contract address to call for execution of the liquidation.
   */
  contract: Address;
  /**
   * Calldata for the contract call.
   */
  calldata: Hex;
  /**
   * Value to send with the contract call.
   */
  value: bigint;

  /**
   * Tokens required to repay the debt
   */
  repayTokens: TokenQty[];
  /**
   * Tokens to receive after the liquidation
   */
  receiptTokens: TokenQty[];
};

/**
 * Represents a bid for a liquidation opportunity
 */
export type OpportunityBid = {
  /**
   * Opportunity unique identifier in uuid format
   */
  opportunityId: string;
  /**
   * The permission key required for succesful execution of the liquidation.
   */
  permissionKey: Hex;
  /**
   * Liquidator address
   */
  liquidator: Address;
  /**
   * Signature of the liquidator
   */
  signature: Hex;

  bid: BidInfo;
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
   * @description Calldata for the contract call.
   * @example 0xdeadbeef
   */
  calldata: Hex;
  /**
   * @description The chain id to bid on.
   * @example sepolia
   */
  chainId: ChainId;
  /**
   * @description The contract address to call.
   * @example 0xcA11bde05977b3631167028862bE2a173976CA11
   */
  contract: Address;
};

export type BidStatusUpdate = {
  id: BidId;
  status: components["schemas"]["BidStatus"];
};

export function checkHex(hex: string): Hex {
  if (isHex(hex)) {
    return hex;
  }
  throw new ClientError(`Invalid hex: ${hex}`);
}

export function checkAddress(address: string): Address {
  if (isAddress(address)) {
    return address;
  }
  throw new ClientError(`Invalid address: ${address}`);
}

function checkTokenQty(token: { contract: string; amount: string }): TokenQty {
  return {
    contract: checkAddress(token.contract),
    amount: BigInt(token.amount),
  };
}

type ClientOptions = FetchClientOptions & { baseUrl: string };

export interface WsOptions {
  /**
   * Max time to wait for a response from the server in milliseconds
   */
  response_timeout: number;
}

const DEFAULT_WS_OPTIONS: WsOptions = {
  response_timeout: 5000,
};

export class Client {
  public clientOptions: ClientOptions;
  public wsOptions: WsOptions;
  public websocket?: WebSocket;
  public idCounter = 0;
  public callbackRouter: Record<
    string,
    (response: components["schemas"]["ServerResultMessage"]) => void
  > = {};
  private websocketOpportunityCallback?: (
    opportunity: Opportunity
  ) => Promise<void>;

  private websocketBidStatusCallback?: (
    statusUpdate: BidStatusUpdate
  ) => Promise<void>;

  constructor(
    clientOptions: ClientOptions,
    wsOptions?: WsOptions,
    opportunityCallback?: (opportunity: Opportunity) => Promise<void>,
    bidStatusCallback?: (statusUpdate: BidStatusUpdate) => Promise<void>
  ) {
    this.clientOptions = clientOptions;
    this.wsOptions = { ...DEFAULT_WS_OPTIONS, ...wsOptions };
    this.websocketOpportunityCallback = opportunityCallback;
    this.websocketBidStatusCallback = bidStatusCallback;
  }

  private connectWebsocket() {
    const websocketEndpoint = new URL(this.clientOptions.baseUrl);
    websocketEndpoint.protocol =
      websocketEndpoint.protocol === "https:" ? "wss:" : "ws:";
    websocketEndpoint.pathname = "/v1/ws";

    this.websocket = new WebSocket(websocketEndpoint.toString());
    this.websocket.on("message", async (data) => {
      const message:
        | components["schemas"]["ServerResultResponse"]
        | components["schemas"]["ServerUpdateResponse"] = JSON.parse(
        data.toString()
      );
      if ("type" in message && message.type === "new_opportunity") {
        if (this.websocketOpportunityCallback !== undefined) {
          const convertedOpportunity = this.convertOpportunity(
            message.opportunity
          );
          if (convertedOpportunity !== undefined) {
            await this.websocketOpportunityCallback(convertedOpportunity);
          }
        }
      } else if ("type" in message && message.type === "bid_status_update") {
        if (this.websocketBidStatusCallback !== undefined) {
          await this.websocketBidStatusCallback(message);
        }
      } else if ("id" in message && message.id) {
        // Response to a request sent earlier via the websocket with the same id
        const callback = this.callbackRouter[message.id];
        if (callback !== undefined) {
          callback(message);
          delete this.callbackRouter[message.id];
        }
      } else if ("error" in message) {
        // Can not route error messages to the callback router as they don't have an id
        console.error(message.error);
      }
    });
  }

  /**
   * Converts an opportunity from the server to the client format
   * Returns undefined if the opportunity version is not supported
   * @param opportunity
   */
  private convertOpportunity(
    opportunity: components["schemas"]["OpportunityParamsWithMetadata"]
  ): Opportunity | undefined {
    if (opportunity.version != "v1") {
      console.warn(
        `Can not handle opportunity version: ${opportunity.version}. Please upgrade your client.`
      );
      return undefined;
    }
    return {
      chainId: opportunity.chain_id,
      opportunityId: opportunity.opportunity_id,
      permissionKey: checkHex(opportunity.permission_key),
      contract: checkAddress(opportunity.contract),
      calldata: checkHex(opportunity.calldata),
      value: BigInt(opportunity.value),
      repayTokens: opportunity.repay_tokens.map(checkTokenQty),
      receiptTokens: opportunity.receipt_tokens.map(checkTokenQty),
    };
  }

  /**
   * Subscribes to the specified chains
   *
   * The opportunity handler will be called for opportunities on the specified chains
   * If the opportunity handler is not set, an error will be thrown
   * @param chains
   */
  async subscribeChains(chains: string[]): Promise<void> {
    if (this.websocketOpportunityCallback === undefined) {
      throw new ClientError("Opportunity handler not set");
    }
    await this.requestViaWebsocket({
      method: "subscribe",
      params: {
        chain_ids: chains,
      },
    });
  }

  async submitOpportunityBidViaWebsocket(bid: OpportunityBid): Promise<BidId> {
    const result = await this.requestViaWebsocket({
      method: "post_liquidation_bid",
      params: {
        opportunity_bid: this.toServerOpportunityBid(bid),
        opportunity_id: bid.opportunityId,
      },
    });
    if (result === null) {
      throw new ClientError("Empty response in websocket for bid submission");
    }
    return result.id;
  }

  async submitBidViaWebsocket(bid: Bid): Promise<BidId> {
    const result = await this.requestViaWebsocket({
      method: "post_bid",
      params: {
        bid: this.toServerBid(bid),
      },
    });
    if (result === null) {
      throw new ClientError("Empty response in websocket for bid submission");
    }
    return result.id;
  }

  /**
   * Unsubscribes from the specified chains
   *
   * The opportunity handler will no longer be called for opportunities on the specified chains
   * @param chains
   */
  async unsubscribeChains(chains: string[]): Promise<void> {
    await this.requestViaWebsocket({
      method: "unsubscribe",
      params: {
        chain_ids: chains,
      },
    });
  }

  async requestViaWebsocket(
    msg: components["schemas"]["ClientMessage"]
  ): Promise<components["schemas"]["APIResposne"] | null> {
    const msg_with_id: components["schemas"]["ClientRequest"] = {
      ...msg,
      id: (this.idCounter++).toString(),
    };
    return new Promise((resolve, reject) => {
      this.callbackRouter[msg_with_id.id] = (response) => {
        if (response.status === "success") {
          resolve(response.result);
        } else {
          reject(response.result);
        }
      };
      if (this.websocket === undefined) {
        this.connectWebsocket();
      }
      if (this.websocket !== undefined) {
        if (this.websocket.readyState === WebSocket.CONNECTING) {
          this.websocket.on("open", () => {
            this.websocket?.send(JSON.stringify(msg_with_id));
          });
        } else if (this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify(msg_with_id));
        } else {
          reject("Websocket connection closing or already closed");
        }
      }
      setTimeout(() => {
        delete this.callbackRouter[msg_with_id.id];
        reject("Websocket response timeout");
      }, this.wsOptions.response_timeout);
    });
  }

  /**
   * Fetches liquidation opportunities
   * @param chainId Chain id to fetch opportunities for. e.g: sepolia
   */
  async getOpportunities(chainId?: string): Promise<Opportunity[]> {
    const client = createClient<paths>(this.clientOptions);
    const opportunities = await client.GET("/v1/liquidation/opportunities", {
      params: { query: { chain_id: chainId } },
    });
    if (opportunities.data === undefined) {
      throw new ClientError("No opportunities found");
    }
    return opportunities.data.flatMap((opportunity) => {
      const convertedOpportunity = this.convertOpportunity(opportunity);
      if (convertedOpportunity === undefined) {
        return [];
      }
      return convertedOpportunity;
    });
  }

  /**
   * Submits a liquidation opportunity to be exposed to searchers
   * @param opportunity Opportunity to submit
   */
  async submitOpportunity(opportunity: Omit<Opportunity, "opportunityId">) {
    const client = createClient<paths>(this.clientOptions);
    const response = await client.POST("/v1/liquidation/opportunities", {
      body: {
        chain_id: opportunity.chainId,
        version: "v1",
        permission_key: opportunity.permissionKey,
        contract: opportunity.contract,
        calldata: opportunity.calldata,
        value: opportunity.value.toString(),
        repay_tokens: opportunity.repayTokens.map((token) => ({
          contract: token.contract,
          amount: token.amount.toString(),
        })),
        receipt_tokens: opportunity.receiptTokens.map((token) => ({
          contract: token.contract,
          amount: token.amount.toString(),
        })),
      },
    });
    if (response.error) {
      throw new ClientError(response.error.error);
    }
  }

  /**
   * Creates a signed bid for a liquidation opportunity
   * @param opportunity Opportunity to bid on
   * @param bidInfo Bid amount and valid until timestamp
   * @param privateKey Private key to sign the bid with
   */
  async signOpportunityBid(
    opportunity: Opportunity,
    bidInfo: BidInfo,
    privateKey: Hex
  ): Promise<OpportunityBid> {
    const account = privateKeyToAccount(privateKey);
    const convertTokenQty = (token: TokenQty): [Hex, bigint] => [
      token.contract,
      token.amount,
    ];
    const payload = encodeAbiParameters(
      [
        {
          name: "repayTokens",
          type: "tuple[]",
          components: [
            {
              type: "address",
            },
            {
              type: "uint256",
            },
          ],
        },
        {
          name: "receiptTokens",
          type: "tuple[]",
          components: [
            {
              type: "address",
            },
            {
              type: "uint256",
            },
          ],
        },
        { name: "contract", type: "address" },
        { name: "calldata", type: "bytes" },
        { name: "value", type: "uint256" },
        { name: "bid", type: "uint256" },
        { name: "validUntil", type: "uint256" },
      ],
      [
        opportunity.repayTokens.map(convertTokenQty),
        opportunity.receiptTokens.map(convertTokenQty),
        opportunity.contract,
        opportunity.calldata,
        opportunity.value,
        bidInfo.amount,
        bidInfo.validUntil,
      ]
    );

    const msgHash = keccak256(payload);

    const hash = signatureToHex(await sign({ hash: msgHash, privateKey }));
    return {
      permissionKey: opportunity.permissionKey,
      bid: bidInfo,
      liquidator: account.address,
      signature: hash,
      opportunityId: opportunity.opportunityId,
    };
  }

  private toServerOpportunityBid(
    bid: OpportunityBid
  ): components["schemas"]["OpportunityBid"] {
    return {
      amount: bid.bid.amount.toString(),
      liquidator: bid.liquidator,
      permission_key: bid.permissionKey,
      signature: bid.signature,
      valid_until: bid.bid.validUntil.toString(),
    };
  }

  private toServerBid(bid: Bid): components["schemas"]["Bid"] {
    return {
      amount: bid.amount.toString(),
      calldata: bid.calldata,
      chain_id: bid.chainId,
      contract: bid.contract,
      permission_key: bid.permissionKey,
    };
  }

  /**
   * Submits a bid for a liquidation opportunity
   * @param bid
   * @returns The id of the submitted bid, you can use this id to track the status of the bid
   */
  async submitOpportunityBid(bid: OpportunityBid): Promise<BidId> {
    const client = createClient<paths>(this.clientOptions);
    const response = await client.POST(
      "/v1/liquidation/opportunities/{opportunity_id}/bids",
      {
        body: this.toServerOpportunityBid(bid),
        params: { path: { opportunity_id: bid.opportunityId } },
      }
    );
    if (response.error) {
      throw new ClientError(response.error.error);
    } else if (response.data === undefined) {
      throw new ClientError("No data returned");
    } else {
      return response.data.id;
    }
  }

  /**
   * Submits a raw bid for a permission key
   * @param bid
   * @returns The id of the submitted bid, you can use this id to track the status of the bid
   */
  async submitBid(bid: Bid): Promise<BidId> {
    const client = createClient<paths>(this.clientOptions);
    const response = await client.POST("/v1/bids", {
      body: this.toServerBid(bid),
    });
    if (response.error) {
      throw new ClientError(response.error.error);
    } else if (response.data === undefined) {
      throw new ClientError("No data returned");
    } else {
      return response.data.id;
    }
  }
}
