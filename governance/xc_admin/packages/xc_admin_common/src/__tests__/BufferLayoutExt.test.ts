import fc from "fast-check";
import { u64be } from "../governance_payload/BufferLayoutExt";

test("Buffer layout extension fc test", (done) => {
  const u64 = u64be();
  const uint8Array = new Uint8Array([0, 0, 0, 0, 161, 189, 5, 128]);

  expect(u64.decode(uint8Array)).toBe(2713519488n);

  let encodedUint8Array = new Uint8Array(8);
  u64.encode(2713519488n, encodedUint8Array);
  expect(
    Buffer.from(encodedUint8Array).equals(Buffer.from(uint8Array))
  ).toBeTruthy();

  done();
});

test("Buffer layout extension fc tests", (done) => {
  const u64 = u64be();
  fc.assert(
    fc.property(fc.bigUintN(64), (bi) => {
      let encodedUint8Array = new Uint8Array(8);
      u64.encode(bi, encodedUint8Array);

      let buffer = Buffer.alloc(8);
      buffer.writeBigUInt64BE(bi);

      const decodedBI = u64.decode(buffer);
      return buffer.equals(encodedUint8Array) && bi === decodedBI;
    })
  );

  done();
});
