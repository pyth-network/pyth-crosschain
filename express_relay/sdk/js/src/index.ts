import type { components, paths } from "./serverTypes";
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
import {
  Bid,
  BidId,
  BidParams,
  BidStatusUpdate,
  Opportunity,
  OpportunityBid,
  OpportunityParams,
  TokenAmount,
} from "./types";

export * from "./types";

export class ClientError extends Error {}

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

export function checkTokenQty(token: {
  token: string;
  amount: string;
}): TokenAmount {
  return {
    token: checkAddress(token.token),
    amount: BigInt(token.amount),
  };
}

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
    this.websocket.on("message", async (data: string) => {
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
          await this.websocketBidStatusCallback({
            id: message.status.id,
            ...message.status.bid_status,
          });
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
      targetContract: checkAddress(opportunity.target_contract),
      targetCalldata: checkHex(opportunity.target_calldata),
      targetCallValue: BigInt(opportunity.target_call_value),
      sellTokens: opportunity.sell_tokens.map(checkTokenQty),
      buyTokens: opportunity.buy_tokens.map(checkTokenQty),
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
  ): Promise<components["schemas"]["APIResponse"] | null> {
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
   * Fetches opportunities
   * @param chainId Chain id to fetch opportunities for. e.g: sepolia
   */
  async getOpportunities(chainId?: string): Promise<Opportunity[]> {
    const client = createClient<paths>(this.clientOptions);
    const opportunities = await client.GET("/v1/opportunities", {
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
   * Submits an opportunity to be exposed to searchers
   * @param opportunity Opportunity to submit
   */
  async submitOpportunity(opportunity: OpportunityParams) {
    const client = createClient<paths>(this.clientOptions);
    const response = await client.POST("/v1/opportunities", {
      body: {
        chain_id: opportunity.chainId,
        version: "v1",
        permission_key: opportunity.permissionKey,
        target_contract: opportunity.targetContract,
        target_calldata: opportunity.targetCalldata,
        target_call_value: opportunity.targetCallValue.toString(),
        sell_tokens: opportunity.sellTokens.map(({ token, amount }) => ({
          token,
          amount: amount.toString(),
        })),
        buy_tokens: opportunity.buyTokens.map(({ token, amount }) => ({
          token,
          amount: amount.toString(),
        })),
      },
    });
    if (response.error) {
      throw new ClientError(response.error.error);
    }
  }

  /**
   * Creates a signed bid for an opportunity
   * @param opportunity Opportunity to bid on
   * @param bidParams Bid amount and valid until timestamp
   * @param privateKey Private key to sign the bid with
   */
  async signOpportunityBid(
    opportunity: Opportunity,
    bidParams: BidParams,
    privateKey: Hex
  ): Promise<OpportunityBid> {
    const account = privateKeyToAccount(privateKey);
    const convertTokenQty = ({ token, amount }: TokenAmount): [Hex, bigint] => [
      token,
      amount,
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
        opportunity.sellTokens.map(convertTokenQty),
        opportunity.buyTokens.map(convertTokenQty),
        opportunity.targetContract,
        opportunity.targetCalldata,
        opportunity.targetCallValue,
        bidParams.amount,
        bidParams.validUntil,
      ]
    );

    const msgHash = keccak256(payload);

    const hash = signatureToHex(await sign({ hash: msgHash, privateKey }));
    return {
      permissionKey: opportunity.permissionKey,
      bid: bidParams,
      executor: account.address,
      signature: hash,
      opportunityId: opportunity.opportunityId,
    };
  }

  private toServerOpportunityBid(
    bid: OpportunityBid
  ): components["schemas"]["OpportunityBid"] {
    return {
      amount: bid.bid.amount.toString(),
      executor: bid.executor,
      permission_key: bid.permissionKey,
      signature: bid.signature,
      valid_until: bid.bid.validUntil.toString(),
    };
  }

  private toServerBid(bid: Bid): components["schemas"]["Bid"] {
    return {
      amount: bid.amount.toString(),
      target_calldata: bid.targetCalldata,
      chain_id: bid.chainId,
      target_contract: bid.targetContract,
      permission_key: bid.permissionKey,
    };
  }

  /**
   * Submits a bid for an opportunity
   * @param bid
   * @param subscribeToUpdates If true, the client will subscribe to bid status updates via websocket and will call the bid status callback if set
   * @returns The id of the submitted bid, you can use this id to track the status of the bid
   */
  async submitOpportunityBid(
    bid: OpportunityBid,
    subscribeToUpdates = true
  ): Promise<BidId> {
    const serverBid = this.toServerOpportunityBid(bid);
    if (subscribeToUpdates) {
      const result = await this.requestViaWebsocket({
        method: "post_opportunity_bid",
        params: {
          opportunity_bid: serverBid,
          opportunity_id: bid.opportunityId,
        },
      });
      if (result === null) {
        throw new ClientError("Empty response in websocket for bid submission");
      }
      return result.id;
    } else {
      const client = createClient<paths>(this.clientOptions);
      const response = await client.POST(
        "/v1/opportunities/{opportunity_id}/bids",
        {
          body: serverBid,
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
  }

  /**
   * Submits a raw bid for a permission key
   * @param bid
   * @param subscribeToUpdates If true, the client will subscribe to bid status updates via websocket and will call the bid status callback if set
   * @returns The id of the submitted bid, you can use this id to track the status of the bid
   */
  async submitBid(bid: Bid, subscribeToUpdates = true): Promise<BidId> {
    const serverBid = this.toServerBid(bid);
    if (subscribeToUpdates) {
      const result = await this.requestViaWebsocket({
        method: "post_bid",
        params: {
          bid: serverBid,
        },
      });
      if (result === null) {
        throw new ClientError("Empty response in websocket for bid submission");
      }
      return result.id;
    } else {
      const client = createClient<paths>(this.clientOptions);
      const response = await client.POST("/v1/bids", {
        body: serverBid,
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
}
