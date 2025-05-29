import WebSocket from "isomorphic-ws";

import type { ParsedPayload, Request, Response } from "./protocol.js";
import { BINARY_UPDATE_FORMAT_MAGIC_LE, FORMAT_MAGICS_LE } from "./protocol.js";
import type { WebSocketPoolConfig } from "./socket/websocket-pool.js";
import { WebSocketPool } from "./socket/websocket-pool.js";

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

export class PythLazerClient {
  private constructor(private readonly wsp: WebSocketPool) {}

  /**
   * Creates a new PythLazerClient instance.
   * @param urls - List of WebSocket URLs of the Pyth Lazer service
   * @param token - The access token for authentication
   * @param numConnections - The number of parallel WebSocket connections to establish (default: 3). A higher number gives a more reliable stream. The connections will round-robin across the provided URLs.
   * @param logger - Optional logger to get socket level logs. Compatible with most loggers such as the built-in console and `bunyan`.
   */
  static async create(config: WebSocketPoolConfig): Promise<PythLazerClient> {
    const wsp = await WebSocketPool.create(config);
    return new PythLazerClient(wsp);
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
}
