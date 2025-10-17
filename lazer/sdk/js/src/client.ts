import WebSocket from "isomorphic-ws";
import type { Logger } from "ts-log";
import { dummyLogger } from "ts-log";

import {
  DEFAULT_METADATA_SERVICE_URL,
  DEFAULT_PRICE_SERVICE_URL,
} from "./constants.js";
import type {
  ParsedPayload,
  Request,
  Response,
  SymbolResponse,
  SymbolsQueryParams,
  LatestPriceRequest,
  PriceRequest,
  JsonUpdate,
} from "./protocol.js";
import { BINARY_UPDATE_FORMAT_MAGIC_LE, FORMAT_MAGICS_LE } from "./protocol.js";
import type { WebSocketPoolConfig } from "./socket/websocket-pool.js";
import { WebSocketPool } from "./socket/websocket-pool.js";
import { bufferFromWebsocketData } from "./util/buffer-util.js";

export type BinaryResponse = {
  subscriptionId: number;
  evm?: Buffer | undefined;
  solana?: Buffer | undefined;
  parsed?: ParsedPayload | undefined;
  leEcdsa?: Buffer | undefined;
  leUnsigned?: Buffer | undefined;
};
export type JsonOrBinaryResponse =
  | {
      type: "json";
      value: Response;
    }
  | { type: "binary"; value: BinaryResponse };

const UINT16_NUM_BYTES = 2;
const UINT32_NUM_BYTES = 4;
const UINT64_NUM_BYTES = 8;

export type LazerClientConfig = {
  token: string;
  metadataServiceUrl?: string;
  priceServiceUrl?: string;
  logger?: Logger;
  webSocketPoolConfig?: WebSocketPoolConfig;
};

export class PythLazerClient {
  private constructor(
    private readonly token: string,
    private readonly metadataServiceUrl: string,
    private readonly priceServiceUrl: string,
    private readonly logger: Logger,
    private readonly wsp?: WebSocketPool,
  ) {}

  /**
   * Gets the WebSocket pool. If the WebSocket pool is not configured, an error is thrown.
   * @throws Error if WebSocket pool is not configured
   * @returns The WebSocket pool
   */
  private getWebSocketPool(): WebSocketPool {
    if (!this.wsp) {
      throw new Error(
        "WebSocket pool is not available. Make sure to provide webSocketPoolConfig when creating the client.",
      );
    }
    return this.wsp;
  }

  /**
   * Creates a new PythLazerClient instance.
   * @param config - Configuration including token, metadata service URL, and price service URL, and WebSocket pool configuration
   */
  static async create(config: LazerClientConfig): Promise<PythLazerClient> {
    const token = config.token;

    // Collect and remove trailing slash from URLs
    const metadataServiceUrl = (
      config.metadataServiceUrl ?? DEFAULT_METADATA_SERVICE_URL
    ).replace(/\/+$/, "");
    const priceServiceUrl = (
      config.priceServiceUrl ?? DEFAULT_PRICE_SERVICE_URL
    ).replace(/\/+$/, "");
    const logger = config.logger ?? dummyLogger;

    // If webSocketPoolConfig is provided, create a WebSocket pool and block until at least one connection is established.
    let wsp: WebSocketPool | undefined;
    if (config.webSocketPoolConfig) {
      wsp = await WebSocketPool.create(
        config.webSocketPoolConfig,
        token,
        logger,
      );
    }
    return new PythLazerClient(
      token,
      metadataServiceUrl,
      priceServiceUrl,
      logger,
      wsp,
    );
  }

  /**
   * Adds a message listener that receives either JSON or binary responses from the WebSocket connections.
   * The listener will be called for each message received, with deduplication across redundant connections.
   * @param handler - Callback function that receives the parsed message. The message can be either a JSON response
   * or a binary response containing EVM, Solana, or parsed payload data.
   */
  addMessageListener(handler: (event: JsonOrBinaryResponse) => void) {
    const wsp = this.getWebSocketPool();
    wsp.addMessageListener(async (data: WebSocket.Data) => {
      if (typeof data == "string") {
        handler({
          type: "json",
          value: JSON.parse(data) as Response,
        });
        return;
      }
      const buffData = await bufferFromWebsocketData(data);
      let pos = 0;
      const magic = buffData
        .subarray(pos, pos + UINT32_NUM_BYTES)
        .readUint32LE();
      pos += UINT32_NUM_BYTES;
      if (magic != BINARY_UPDATE_FORMAT_MAGIC_LE) {
        throw new Error("binary update format magic mismatch");
      }
      // TODO: some uint64 values may not be representable as Number.
      const subscriptionId = Number(
        buffData.subarray(pos, pos + UINT64_NUM_BYTES).readBigInt64BE(),
      );
      pos += UINT64_NUM_BYTES;

      const value: BinaryResponse = { subscriptionId };
      while (pos < buffData.length) {
        const len = buffData
          .subarray(pos, pos + UINT16_NUM_BYTES)
          .readUint16BE();
        pos += UINT16_NUM_BYTES;
        const magic = buffData
          .subarray(pos, pos + UINT32_NUM_BYTES)
          .readUint32LE();
        if (magic == FORMAT_MAGICS_LE.EVM) {
          value.evm = buffData.subarray(pos, pos + len);
        } else if (magic == FORMAT_MAGICS_LE.SOLANA) {
          value.solana = buffData.subarray(pos, pos + len);
        } else if (magic == FORMAT_MAGICS_LE.LE_ECDSA) {
          value.leEcdsa = buffData.subarray(pos, pos + len);
        } else if (magic == FORMAT_MAGICS_LE.LE_UNSIGNED) {
          value.leUnsigned = buffData.subarray(pos, pos + len);
        } else if (magic == FORMAT_MAGICS_LE.JSON) {
          value.parsed = JSON.parse(
            buffData.subarray(pos + UINT32_NUM_BYTES, pos + len).toString(),
          ) as ParsedPayload;
        } else {
          throw new Error(`unknown magic:  ${magic.toString()}`);
        }
        pos += len;
      }
      handler({ type: "binary", value });
    });
  }

  subscribe(request: Request) {
    const wsp = this.getWebSocketPool();
    if (request.type !== "subscribe") {
      throw new Error("Request must be a subscribe request");
    }
    wsp.addSubscription(request);
  }

  unsubscribe(subscriptionId: number) {
    const wsp = this.getWebSocketPool();
    wsp.removeSubscription(subscriptionId);
  }

  send(request: Request) {
    const wsp = this.getWebSocketPool();
    wsp.sendRequest(request);
  }

  /**
   * Registers a handler function that will be called whenever all WebSocket connections are down or attempting to reconnect.
   * The connections may still try to reconnect in the background. To shut down the pool, call `shutdown()`.
   * @param handler - Function to be called when all connections are down
   */
  addAllConnectionsDownListener(handler: () => void): void {
    const wsp = this.getWebSocketPool();
    wsp.addAllConnectionsDownListener(handler);
  }

  shutdown(): void {
    const wsp = this.getWebSocketPool();
    wsp.shutdown();
  }

  /**
   * Private helper method to make authenticated HTTP requests with Bearer token
   * @param url - The URL to fetch
   * @param options - Additional fetch options
   * @returns Promise resolving to the fetch Response
   */
  private async authenticatedFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<globalThis.Response> {
    const headers = {
      Authorization: `Bearer ${this.token}`,
      ...(options.headers as Record<string, string>),
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Queries the symbols endpoint to get available price feed symbols.
   * @param params - Optional query parameters to filter symbols
   * @returns Promise resolving to array of symbol information
   */
  async getSymbols(params?: SymbolsQueryParams): Promise<SymbolResponse[]> {
    const url = new URL(`${this.metadataServiceUrl}/v1/symbols`);

    if (params?.query) {
      url.searchParams.set("query", params.query);
    }
    if (params?.asset_type) {
      url.searchParams.set("asset_type", params.asset_type);
    }

    try {
      const response = await this.authenticatedFetch(url.toString());
      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${String(response.status)} - ${await response.text()}`,
        );
      }
      return (await response.json()) as SymbolResponse[];
    } catch (error) {
      throw new Error(
        `Failed to fetch symbols: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Queries the latest price endpoint to get current price data.
   * @param params - Parameters for the latest price request
   * @returns Promise resolving to JsonUpdate with current price data
   */
  async getLatestPrice(params: LatestPriceRequest): Promise<JsonUpdate> {
    const url = `${this.priceServiceUrl}/v1/latest_price`;

    try {
      const body = JSON.stringify(params);
      this.logger.debug("getLatestPrice", { url, body });
      const response = await this.authenticatedFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body,
      });
      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${String(response.status)} - ${await response.text()}`,
        );
      }
      return (await response.json()) as JsonUpdate;
    } catch (error) {
      throw new Error(
        `Failed to fetch latest price: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Queries the price endpoint to get historical price data at a specific timestamp.
   * @param params - Parameters for the price request including timestamp
   * @returns Promise resolving to JsonUpdate with price data at the specified time
   */
  async getPrice(params: PriceRequest): Promise<JsonUpdate> {
    const url = `${this.priceServiceUrl}/v1/price`;

    try {
      const body = JSON.stringify(params);
      this.logger.debug("getPrice", { url, body });
      const response = await this.authenticatedFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body,
      });
      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${String(response.status)} - ${await response.text()}`,
        );
      }
      return (await response.json()) as JsonUpdate;
    } catch (error) {
      throw new Error(
        `Failed to fetch price: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
