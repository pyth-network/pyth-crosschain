import WebSocket from "isomorphic-ws";
import { dummyLogger, type Logger } from "ts-log";

import {
  BINARY_UPDATE_FORMAT_MAGIC,
  EVM_FORMAT_MAGIC,
  PARSED_FORMAT_MAGIC,
  type ParsedPayload,
  type Request,
  type Response,
  SOLANA_FORMAT_MAGIC_BE,
} from "./protocol.js";
import { WebSocketPool } from "./socket/web-socket-pool.js";

export type BinaryResponse = {
  subscriptionId: number;
  evm?: Buffer | undefined;
  solana?: Buffer | undefined;
  parsed?: ParsedPayload | undefined;
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
  wsp: WebSocketPool;

  /**
   * Creates a new PythLazerClient instance.
   * @param urls - List of WebSocket URLs of the Pyth Lazer service
   * @param token - The access token for authentication
   * @param numConnections - The number of parallel WebSocket connections to establish (default: 3). A higher number gives a more reliable stream.
   * @param logger - Optional logger to get socket level logs. Compatible with most loggers such as the built-in console and `bunyan`.
   */
  constructor(
    urls: string[],
    token: string,
    numConnections = 3,
    logger: Logger = dummyLogger
  ) {
    this.wsp = new WebSocketPool(urls, token, numConnections, logger);
  }

  addMessageListener(handler: (event: JsonOrBinaryResponse) => void) {
    this.wsp.addMessageListener((data: WebSocket.Data) => {
      if (typeof data == "string") {
        handler({
          type: "json",
          value: JSON.parse(data) as Response,
        });
      } else if (Buffer.isBuffer(data)) {
        let pos = 0;
        const magic = data.subarray(pos, pos + UINT32_NUM_BYTES).readUint32BE();
        pos += UINT32_NUM_BYTES;
        if (magic != BINARY_UPDATE_FORMAT_MAGIC) {
          throw new Error("binary update format magic mismatch");
        }
        // TODO: some uint64 values may not be representable as Number.
        const subscriptionId = Number(
          data.subarray(pos, pos + UINT64_NUM_BYTES).readBigInt64BE()
        );
        pos += UINT64_NUM_BYTES;

        const value: BinaryResponse = { subscriptionId };
        while (pos < data.length) {
          const len = data.subarray(pos, pos + UINT16_NUM_BYTES).readUint16BE();
          pos += UINT16_NUM_BYTES;
          const magic = data
            .subarray(pos, pos + UINT32_NUM_BYTES)
            .readUint32BE();
          if (magic == EVM_FORMAT_MAGIC) {
            value.evm = data.subarray(pos, pos + len);
          } else if (magic == SOLANA_FORMAT_MAGIC_BE) {
            value.solana = data.subarray(pos, pos + len);
          } else if (magic == PARSED_FORMAT_MAGIC) {
            value.parsed = JSON.parse(
              data.subarray(pos + UINT32_NUM_BYTES, pos + len).toString()
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

  async subscribe(request: Request): Promise<void> {
    if (request.type !== "subscribe") {
      throw new Error("Request must be a subscribe request");
    }
    await this.wsp.addSubscription(request);
  }

  async unsubscribe(subscriptionId: number): Promise<void> {
    await this.wsp.removeSubscription(subscriptionId);
  }

  async send(request: Request): Promise<void> {
    await this.wsp.sendRequest(request);
  }

  shutdown(): void {
    this.wsp.shutdown();
  }
}
