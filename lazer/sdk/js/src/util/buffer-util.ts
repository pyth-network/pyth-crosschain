// the linting rules don't allow importing anything that might clash with
// a global, top-level import. we disable this rule because we need this
// imported from our installed dependency
// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer as BrowserBuffer } from "buffer";

import type { Data } from "isomorphic-ws";

const BufferClassToUse =
  "Buffer" in globalThis ? globalThis.Buffer : BrowserBuffer;

/**
 * given a relatively unknown websocket frame data object,
 * returns a valid Buffer instance that is safe to use
 * isomorphically in any JS runtime environment
 */
export async function bufferFromWebsocketData(data: Data): Promise<Buffer> {
  if (typeof data === "string") {
    return BufferClassToUse.from(new TextEncoder().encode(data).buffer);
  }

  if (data instanceof BufferClassToUse) return data;

  if (data instanceof Blob) {
    // let the uncaught promise exception bubble up if there's an issue
    return BufferClassToUse.from(await data.arrayBuffer());
  }

  if (data instanceof ArrayBuffer) return BufferClassToUse.from(data);

  if (Array.isArray(data)) {
    // an array of buffers is highly unlikely, but it is a possibility
    // indicated by the WebSocket Data interface
    return BufferClassToUse.concat(data);
  }

  return data;
}
