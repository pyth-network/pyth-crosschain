import WebSocket from "isomorphic-ws";

import {
  BINARY_UPDATE_FORMAT_MAGIC,
  EVM_FORMAT_MAGIC,
  PARSED_FORMAT_MAGIC,
  type ParsedPayload,
  type Request,
  type Response,
  SOLANA_FORMAT_MAGIC_BE,
} from "./protocol.js";

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
  ws: WebSocket;

  constructor(url: string, token: string) {
    const finalUrl = new URL(url);
    finalUrl.searchParams.append("ACCESS_TOKEN", token);
    this.ws = new WebSocket(finalUrl);
  }

  addMessageListener(handler: (event: JsonOrBinaryResponse) => void) {
    this.ws.addEventListener("message", (event: WebSocket.MessageEvent) => {
      if (typeof event.data == "string") {
        handler({
          type: "json",
          value: JSON.parse(event.data) as Response,
        });
      } else if (Buffer.isBuffer(event.data)) {
        let pos = 0;
        const magic = event.data
          .subarray(pos, pos + UINT32_NUM_BYTES)
          .readUint32BE();
        pos += UINT32_NUM_BYTES;
        if (magic != BINARY_UPDATE_FORMAT_MAGIC) {
          throw new Error("binary update format magic mismatch");
        }
        // TODO: some uint64 values may not be representable as Number.
        const subscriptionId = Number(
          event.data.subarray(pos, pos + UINT64_NUM_BYTES).readBigInt64BE()
        );
        pos += UINT64_NUM_BYTES;

        const value: BinaryResponse = { subscriptionId };
        while (pos < event.data.length) {
          const len = event.data
            .subarray(pos, pos + UINT16_NUM_BYTES)
            .readUint16BE();
          pos += UINT16_NUM_BYTES;
          const magic = event.data
            .subarray(pos, pos + UINT32_NUM_BYTES)
            .readUint32BE();
          if (magic == EVM_FORMAT_MAGIC) {
            value.evm = event.data.subarray(pos, pos + len);
          } else if (magic == SOLANA_FORMAT_MAGIC_BE) {
            value.solana = event.data.subarray(pos, pos + len);
          } else if (magic == PARSED_FORMAT_MAGIC) {
            value.parsed = JSON.parse(
              event.data.subarray(pos + UINT32_NUM_BYTES, pos + len).toString()
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

  send(request: Request) {
    this.ws.send(JSON.stringify(request));
  }
}
