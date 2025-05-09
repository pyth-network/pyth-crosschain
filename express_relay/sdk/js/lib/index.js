"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = exports.ClientError = void 0;
exports.checkHex = checkHex;
exports.checkAddress = checkAddress;
exports.checkTokenQty = checkTokenQty;
const openapi_fetch_1 = __importDefault(require("openapi-fetch"));
const viem_1 = require("viem");
const isomorphic_ws_1 = __importDefault(require("isomorphic-ws"));
const web3_js_1 = require("@solana/web3.js");
const limo_sdk_1 = require("@kamino-finance/limo-sdk");
const utils_1 = require("@kamino-finance/limo-sdk/dist/utils");
const evm = __importStar(require("./evm"));
const svm = __importStar(require("./svm"));
__exportStar(require("./types"), exports);
__exportStar(require("./const"), exports);
class ClientError extends Error {}
exports.ClientError = ClientError;
const DEFAULT_WS_OPTIONS = {
  response_timeout: 10000,
};
function checkHex(hex) {
  if ((0, viem_1.isHex)(hex)) {
    return hex;
  }
  throw new ClientError(`Invalid hex: ${hex}`);
}
function checkAddress(address) {
  if ((0, viem_1.isAddress)(address)) {
    return address;
  }
  throw new ClientError(`Invalid address: ${address}`);
}
function checkTokenQty(token) {
  return {
    token: checkAddress(token.token),
    amount: BigInt(token.amount),
  };
}
class Client {
  clientOptions;
  wsOptions;
  websocket;
  idCounter = 0;
  callbackRouter = {};
  websocketOpportunityCallback;
  websocketBidStatusCallback;
  getAuthorization() {
    return this.clientOptions.apiKey
      ? {
          Authorization: `Bearer ${this.clientOptions.apiKey}`,
        }
      : {};
  }
  constructor(
    clientOptions,
    wsOptions,
    opportunityCallback,
    bidStatusCallback,
  ) {
    this.clientOptions = clientOptions;
    this.clientOptions.headers = {
      ...(this.clientOptions.headers ?? {}),
      ...this.getAuthorization(),
    };
    this.wsOptions = { ...DEFAULT_WS_OPTIONS, ...wsOptions };
    this.websocketOpportunityCallback = opportunityCallback;
    this.websocketBidStatusCallback = bidStatusCallback;
  }
  connectWebsocket() {
    const websocketEndpoint = new URL(this.clientOptions.baseUrl);
    websocketEndpoint.protocol =
      websocketEndpoint.protocol === "https:" ? "wss:" : "ws:";
    websocketEndpoint.pathname = "/v1/ws";
    this.websocket = new isomorphic_ws_1.default(websocketEndpoint.toString(), {
      headers: this.getAuthorization(),
    });
    this.websocket.on("message", async (data) => {
      const message = JSON.parse(data.toString());
      if ("type" in message && message.type === "new_opportunity") {
        if (this.websocketOpportunityCallback !== undefined) {
          const convertedOpportunity = this.convertOpportunity(
            message.opportunity,
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
   * Subscribes to the specified chains
   *
   * The opportunity handler will be called for opportunities on the specified chains
   * If the opportunity handler is not set, an error will be thrown
   * @param chains
   */
  async subscribeChains(chains) {
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
  async unsubscribeChains(chains) {
    await this.requestViaWebsocket({
      method: "unsubscribe",
      params: {
        chain_ids: chains,
      },
    });
  }
  async requestViaWebsocket(msg) {
    const msg_with_id = {
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
        if (this.websocket.readyState === isomorphic_ws_1.default.CONNECTING) {
          this.websocket.on("open", () => {
            this.websocket?.send(JSON.stringify(msg_with_id));
          });
        } else if (this.websocket.readyState === isomorphic_ws_1.default.OPEN) {
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
   * @returns List of opportunities
   */
  async getOpportunities(chainId) {
    const client = (0, openapi_fetch_1.default)(this.clientOptions);
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
  async submitOpportunity(opportunity) {
    const client = (0, openapi_fetch_1.default)(this.clientOptions);
    let body;
    if ("order" in opportunity) {
      const encoded_order = Buffer.alloc(
        limo_sdk_1.Order.discriminator.length + limo_sdk_1.Order.layout.span,
      );
      limo_sdk_1.Order.discriminator.copy(encoded_order);
      limo_sdk_1.Order.layout.encode(
        opportunity.order.state,
        encoded_order,
        limo_sdk_1.Order.discriminator.length,
      );
      body = {
        chain_id: opportunity.chainId,
        version: "v1",
        program: opportunity.program,
        order: encoded_order.toString("base64"),
        slot: opportunity.slot,
        block_hash: opportunity.blockHash,
        order_address: opportunity.order.address.toBase58(),
        buy_tokens: [
          {
            token: opportunity.order.state.inputMint.toBase58(),
            amount: opportunity.order.state.remainingInputAmount.toNumber(),
          },
        ],
        sell_tokens: [
          {
            token: opportunity.order.state.outputMint.toBase58(),
            amount: opportunity.order.state.expectedOutputAmount.toNumber(),
          },
        ],
        permission_account: opportunity.order.address.toBase58(),
        router: (0, utils_1.getPdaAuthority)(
          limo_sdk_1.limoId,
          opportunity.order.state.globalConfig,
        ).toBase58(),
      };
    } else {
      body = {
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
      };
    }
    const response = await client.POST("/v1/opportunities", {
      body: body,
    });
    if (response.error) {
      throw new ClientError(response.error.error);
    }
  }
  /**
   * Submits a raw bid for a permission key
   * @param bid
   * @param subscribeToUpdates If true, the client will subscribe to bid status updates via websocket and will call the bid status callback if set
   * @returns The id of the submitted bid, you can use this id to track the status of the bid
   */
  async submitBid(bid, subscribeToUpdates = true) {
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
      const client = (0, openapi_fetch_1.default)(this.clientOptions);
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
  /**
   * Get bids for an api key
   * @param fromTime The datetime to fetch bids from. If undefined or null, fetches from the beginning of time.
   * @returns The paginated bids response
   */
  async getBids(fromTime) {
    const client = (0, openapi_fetch_1.default)(this.clientOptions);
    const response = await client.GET("/v1/bids", {
      params: { query: { from_time: fromTime?.toISOString() } },
    });
    if (response.error) {
      throw new ClientError(response.error.error);
    } else if (response.data === undefined) {
      throw new ClientError("No data returned");
    } else {
      return response.data;
    }
  }
  toServerBid(bid) {
    if (bid.env === "evm") {
      return {
        amount: bid.amount.toString(),
        target_calldata: bid.targetCalldata,
        chain_id: bid.chainId,
        target_contract: bid.targetContract,
        permission_key: bid.permissionKey,
      };
    }
    return {
      chain_id: bid.chainId,
      transaction: bid.transaction
        .serialize({ requireAllSignatures: false })
        .toString("base64"),
    };
  }
  /**
   * Converts an opportunity from the server to the client format
   * Returns undefined if the opportunity version is not supported
   * @param opportunity
   * @returns Opportunity in the converted client format
   */
  convertOpportunity(opportunity) {
    if (opportunity.version !== "v1") {
      console.warn(
        `Can not handle opportunity version: ${opportunity.version}. Please upgrade your client.`,
      );
      return undefined;
    }
    if ("target_calldata" in opportunity) {
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
    const order = limo_sdk_1.Order.decode(
      Buffer.from(opportunity.order, "base64"),
    );
    return {
      chainId: opportunity.chain_id,
      slot: opportunity.slot,
      blockHash: opportunity.block_hash,
      opportunityId: opportunity.opportunity_id,
      order: {
        state: order,
        address: new web3_js_1.PublicKey(opportunity.order_address),
      },
      program: "limo",
    };
  }
  // EVM specific functions
  /**
   * Creates a signed opportunity bid for an opportunity
   * @param opportunity EVM Opportunity to bid on
   * @param bidParams Bid amount and valid until timestamp
   * @param privateKey Private key to sign the bid with
   * @returns Signed opportunity bid
   */
  async signOpportunityBid(opportunity, bidParams, privateKey) {
    return evm.signOpportunityBid(opportunity, bidParams, privateKey);
  }
  /**
   * Creates a signed bid for an EVM opportunity
   * @param opportunity EVM Opportunity to bid on
   * @param bidParams Bid amount, nonce, and deadline timestamp
   * @param privateKey Private key to sign the bid with
   * @returns Signed bid
   */
  async signBid(opportunity, bidParams, privateKey) {
    return evm.signBid(opportunity, bidParams, privateKey);
  }
  /**
   * Creates a signature for the bid and opportunity
   * @param opportunity EVM Opportunity to bid on
   * @param bidParams Bid amount, nonce, and deadline timestamp
   * @param privateKey Private key to sign the bid with
   * @returns Signature for the bid and opportunity
   */
  async getSignature(opportunity, bidParams, privateKey) {
    return evm.getSignature(opportunity, bidParams, privateKey);
  }
  // SVM specific functions
  /**
   * Fetches the Express Relay SVM config necessary for bidding
   * @param chainId The id for the chain you want to fetch the config for
   * @param connection The connection to use for fetching the config
   */
  async getExpressRelaySvmConfig(chainId, connection) {
    return svm.getExpressRelaySvmConfig(chainId, connection);
  }
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
  async constructSubmitBidInstruction(
    searcher,
    router,
    permissionKey,
    bidAmount,
    deadline,
    chainId,
    relayerSigner,
    feeReceiverRelayer,
  ) {
    return svm.constructSubmitBidInstruction(
      searcher,
      router,
      permissionKey,
      bidAmount,
      deadline,
      chainId,
      relayerSigner,
      feeReceiverRelayer,
    );
  }
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
  async constructSvmBid(
    tx,
    searcher,
    router,
    permissionKey,
    bidAmount,
    deadline,
    chainId,
    relayerSigner,
    feeReceiverRelayer,
  ) {
    return svm.constructSvmBid(
      tx,
      searcher,
      router,
      permissionKey,
      bidAmount,
      deadline,
      chainId,
      relayerSigner,
      feeReceiverRelayer,
    );
  }
}
exports.Client = Client;
