// the linting rules don't allow importing anything that might clash with
// a global, top-level import. we disable this rule because we need this
// imported from our installed dependency
// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer as BrowserBuffer } from "buffer";

import type { Data } from "isomorphic-ws";

const { Buffer: PossibleBuiltInBuffer } = globalThis as Partial<{
  Buffer: typeof Buffer;
}>;

const BufferClassToUse = PossibleBuiltInBuffer ?? BrowserBuffer;

export class IsomorphicBuffer extends BufferClassToUse {
  /**
   * given a relatively unknown websocket frame data object,
   * returns a valid Buffer instance that is safe to use
   * isomorphically in any JS runtime environment
   */
  static async fromWebsocketData(data: Data) {
    if (typeof data === "string") {
      return BufferClassToUse.from(new TextEncoder().encode(data).buffer);
    }
    if (data instanceof Blob) {
      // let the uncaught promise exception bubble up if there's an issue
      return BufferClassToUse.from(await data.arrayBuffer());
    }
    if (data instanceof ArrayBuffer) return BufferClassToUse.from(data);
    if (Buffer.isBuffer(data)) {
      const arrBuffer = new ArrayBuffer(data.length);
      const v = new Uint8Array(arrBuffer);
      for (const [i, item] of data.entries()) {
        v[i] = item;
      }
      return BufferClassToUse.from(arrBuffer);
    }
    throw new TypeError(
      "unexpected event data type found when IsomorphicBuffer.fromWebsocketData() called",
    );
  }
}
