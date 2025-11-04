import fc from "fast-check";
import { u64be } from "../governance_payload/BufferLayoutExt";
import { test } from "@pythnetwork/test-config";

test("Buffer layout extension fc tests", () => {
  const u64 = u64be();
  fc.assert(
    fc.property(fc.bigUintN(64), (bi) => {
      let encodedUint8Array = new Uint8Array(8);
      u64.encode(bi, encodedUint8Array);

      let buffer = Buffer.alloc(8);
      buffer.writeBigUInt64BE(bi);

      const decodedBI = u64.decode(buffer);
      return buffer.equals(encodedUint8Array) && bi === decodedBI;
    }),
  );
});
