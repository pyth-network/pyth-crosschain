import fetch from "cross-fetch";
import WebSocket from "isomorphic-ws";

import type {
  ParsedPayload,
  Request,
  Response,
  SymbolResponse,
  SymbolsQueryParams,
} from "./protocol.js";
import { BINARY_UPDATE_FORMAT_MAGIC_LE, FORMAT_MAGICS_LE } from "./protocol.js";
import type { WebSocketPoolConfig } from "./socket/websocket-pool.js";
import { WebSocketPool } from "./socket/websocket-pool.js";
import { DEFAULT_HISTORY_SERVICE_URL } from "./constants.js";

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

export type LazerClientConfig = WebSocketPoolConfig & {
  historyServiceUrl?: string;
};

const UINT16_NUM_BYTES = 2;
const UINT32_NUM_BYTES = 4;
const UINT64_NUM_BYTES = 8;

export class PythLazerClient {
  private constructor(
    private readonly wsp: WebSocketPool,
    private readonly historyServiceUrl: string,
  ) { }

  /**
   * Creates a new PythLazerClient instance.
   * @param config - Configuration including WebSocket URLs, token, and optional history service URL
   */
  static async create(config: LazerClientConfig): Promise<PythLazerClient> {
    const wsp = await WebSocketPool.create(config);
    const historyServiceUrl =
      config.historyServiceUrl ??
      DEFAULT_HISTORY_SERVICE_URL;
    return new PythLazerClient(wsp, historyServiceUrl);
  }

  /**
   * Adds a message listener that receives either JSON or binary responses from the WebSocket connections.
   * The listener will be called for each message received, with deduplication across redundant connections.
   * @param handler - Callback function that receives the parsed message. The message can be either a JSON response
   * or a binary response containing EVM, Solana, or parsed payload data.
   */
  addMessageListener(handler: (event: JsonOrBinaryResponse) => void) {
    this.wsp.addMessageListener((data: WebSocket.Data) => {
      if (typeof data == "string") {
        handler({
          type: "json",
          value: JSON.parse(data) as Response,
        });
      } else if (Buffer.isBuffer(data)) {
        let pos = 0;
        const magic = data.subarray(pos, pos + UINT32_NUM_BYTES).readUint32LE();
        pos += UINT32_NUM_BYTES;
        if (magic != BINARY_UPDATE_FORMAT_MAGIC_LE) {
          throw new Error("binary update format magic mismatch");
        }
        // TODO: some uint64 values may not be representable as Number.
        const subscriptionId = Number(
          data.subarray(pos, pos + UINT64_NUM_BYTES).readBigInt64BE(),
        );
        pos += UINT64_NUM_BYTES;

        const value: BinaryResponse = { subscriptionId };
        while (pos < data.length) {
          const len = data.subarray(pos, pos + UINT16_NUM_BYTES).readUint16BE();
          pos += UINT16_NUM_BYTES;
          const magic = data
            .subarray(pos, pos + UINT32_NUM_BYTES)
            .readUint32LE();
          if (magic == FORMAT_MAGICS_LE.EVM) {
            value.evm = data.subarray(pos, pos + len);
          } else if (magic == FORMAT_MAGICS_LE.SOLANA) {
            value.solana = data.subarray(pos, pos + len);
          } else if (magic == FORMAT_MAGICS_LE.LE_ECDSA) {
            value.leEcdsa = data.subarray(pos, pos + len);
          } else if (magic == FORMAT_MAGICS_LE.LE_UNSIGNED) {
            value.leUnsigned = data.subarray(pos, pos + len);
          } else if (magic == FORMAT_MAGICS_LE.JSON) {
            value.parsed = JSON.parse(
              data.subarray(pos + UINT32_NUM_BYTES, pos + len).toString(),
            ) as ParsedPayload;
          } else {
            throw new Error("unknown magic: " + magic.toString());
          }
          pos += len;
        }
        handler({ type: "binary", value });
      } else {
        throw new TypeError("unexpected event data type");
      }
    });
  }

  subscribe(request: Request) {
    if (request.type !== "subscribe") {
      throw new Error("Request must be a subscribe request");
    }
    this.wsp.addSubscription(request);
  }

  unsubscribe(subscriptionId: number) {
    this.wsp.removeSubscription(subscriptionId);
  }

  send(request: Request) {
    this.wsp.sendRequest(request);
  }

  /**
   * Registers a handler function that will be called whenever all WebSocket connections are down or attempting to reconnect.
   * The connections may still try to reconnect in the background. To shut down the pool, call `shutdown()`.
   * @param handler - Function to be called when all connections are down
   */
  addAllConnectionsDownListener(handler: () => void): void {
    this.wsp.addAllConnectionsDownListener(handler);
  }

  shutdown(): void {
    this.wsp.shutdown();
  }

  /**
   * Queries the symbols endpoint to get available price feed symbols.
   * @param params - Optional query parameters to filter symbols
   * @returns Promise resolving to array of symbol information
   */
  async get_symbols(params?: SymbolsQueryParams): Promise<SymbolResponse[]> {
    const url = new URL(`${this.historyServiceUrl}/v1/symbols`);

    if (params?.query) {
      url.searchParams.set("query", params.query);
    }
    if (params?.asset_type) {
      url.searchParams.set("asset_type", params.asset_type);
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${String(response.status)}`);
      }
      return (await response.json()) as SymbolResponse[];
    } catch (error) {
      throw new Error(
        `Failed to fetch symbols: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
