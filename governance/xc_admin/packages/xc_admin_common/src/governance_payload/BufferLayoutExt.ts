import { Layout } from "@solana/buffer-layout";

export class UInt64BE extends Layout<bigint> {
  constructor(span: number, property?: string) {
    super(span, property);
  }

  override decode(b: Uint8Array, offset?: number): bigint {
    let o = offset ?? 0;
    return Buffer.from(b.slice(o, o + this.span)).readBigUInt64BE();
  }

  override encode(src: bigint, b: Uint8Array, offset?: number): number {
    const buffer = Buffer.alloc(this.span);
    buffer.writeBigUint64BE(src);
    b.set(buffer, offset);
    return this.span;
  }
}

export class HexBytes extends Layout<string> {
  // span is the number of bytes to read
  constructor(span: number, property?: string) {
    super(span, property);
  }

  override decode(b: Uint8Array, offset?: number): string {
    let o = offset ?? 0;
    return Buffer.from(b.slice(o, o + this.span)).toString("hex");
  }

  override encode(src: string, b: Uint8Array, offset?: number): number {
    const buffer = Buffer.alloc(this.span);
    buffer.write(src, "hex");
    b.set(buffer, offset);
    return this.span;
  }
}

/** A big-endian u64, returned as a bigint. */
export function u64be(property?: string | undefined): UInt64BE {
  return new UInt64BE(8, property);
}

/** An array of numBytes bytes, returned as a hexadecimal string. */
export function hexBytes(
  numBytes: number,
  property?: string | undefined
): HexBytes {
  return new HexBytes(numBytes, property);
}
