import type { paths, components } from "./types";
import createClient, {
  ClientOptions as FetchClientOptions,
} from "openapi-fetch";
import {
  Address,
  encodeAbiParameters,
  encodePacked,
  Hex,
  isAddress,
  isHex,
  keccak256,
} from "viem";
import { privateKeyToAccount, sign, signatureToHex } from "viem/accounts";
import WebSocket from "isomorphic-ws";
/**
 * ERC20 token with contract address and amount
 */
export type TokenQty = {
  contract: Address;
  amount: bigint;
};

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
  chainId: string;

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

export function checkHex(hex: string): Hex {
  if (isHex(hex)) {
    return hex;
  }
  throw new Error(`Invalid hex: ${hex}`);
}

export function checkAddress(address: string): Address {
  if (isAddress(address)) {
    return address;
  }
  throw new Error(`Invalid address: ${address}`);
}

function checkTokenQty(token: { contract: string; amount: string }): TokenQty {
  return {
    contract: checkAddress(token.contract),
    amount: BigInt(token.amount),
  };
}

type ClientOptions = FetchClientOptions & { baseUrl: string };

export class Client {
  public clientOptions: ClientOptions;
  public websocket?: WebSocket;
  public idCounter = 0;
  public callbackRouter: Record<
    string,
    (response: components["schemas"]["ServerResultMessage"]) => void
  > = {};
  private websocketOpportunityCallback?: (
    opportunity: Opportunity
  ) => Promise<void>;

  constructor(clientOptions: ClientOptions) {
    this.clientOptions = clientOptions;
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
      if ("id" in message && message.id) {
        const callback = this.callbackRouter[message.id];
        if (callback !== undefined) {
          callback(message);
          delete this.callbackRouter[message.id];
        }
      } else if ("type" in message && message.type === "new_opportunity") {
        if (this.websocketOpportunityCallback !== undefined) {
          const convertedOpportunity = this.convertOpportunity(
            message.opportunity
          );
          if (convertedOpportunity !== undefined) {
            await this.websocketOpportunityCallback(convertedOpportunity);
          }
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

  public setOpportunityHandler(
    callback: (opportunity: Opportunity) => Promise<void>
  ) {
    this.websocketOpportunityCallback = callback;
  }

  /**
   * Subscribes to the specified chains
   *
   * The opportunity handler will be called for opportunities on the specified chains
   * If the opportunity handler is not set, an error will be thrown
   * @param chains
   */
  async subscribeChains(chains: string[]) {
    if (this.websocketOpportunityCallback === undefined) {
      throw new Error("Opportunity handler not set");
    }
    return this.sendWebsocketMessage({
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
  async unsubscribeChains(chains: string[]) {
    return this.sendWebsocketMessage({
      method: "unsubscribe",
      params: {
        chain_ids: chains,
      },
    });
  }

  async sendWebsocketMessage(
    msg: components["schemas"]["ClientMessage"]
  ): Promise<void> {
    const msg_with_id: components["schemas"]["ClientRequest"] = {
      ...msg,
      id: (this.idCounter++).toString(),
    };
    return new Promise((resolve, reject) => {
      this.callbackRouter[msg_with_id.id] = (response) => {
        if (response.status === "success") {
          resolve();
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
      throw new Error("No opportunities found");
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
      throw new Error(response.error.error);
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
      ],
      [
        opportunity.repayTokens.map(convertTokenQty),
        opportunity.receiptTokens.map(convertTokenQty),
        opportunity.contract,
        opportunity.calldata,
        opportunity.value,
        bidInfo.amount,
      ]
    );

    const msgHash = keccak256(
      encodePacked(["bytes", "uint256"], [payload, bidInfo.validUntil])
    );

    const hash = signatureToHex(await sign({ hash: msgHash, privateKey }));
    return {
      permissionKey: opportunity.permissionKey,
      bid: bidInfo,
      liquidator: account.address,
      signature: hash,
      opportunityId: opportunity.opportunityId,
    };
  }

  /**
   * Submits a bid for a liquidation opportunity
   * @param bid
   */
  async submitOpportunityBid(bid: OpportunityBid) {
    const client = createClient<paths>(this.clientOptions);
    const response = await client.POST(
      "/v1/liquidation/opportunities/{opportunity_id}/bids",
      {
        body: {
          amount: bid.bid.amount.toString(),
          liquidator: bid.liquidator,
          permission_key: bid.permissionKey,
          signature: bid.signature,
          valid_until: bid.bid.validUntil.toString(),
        },
        params: { path: { opportunity_id: bid.opportunityId } },
      }
    );
    if (response.error) {
      throw new Error(response.error.error);
    }
  }
}
