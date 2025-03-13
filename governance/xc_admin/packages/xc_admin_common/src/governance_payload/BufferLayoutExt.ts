import { Layout } from "@solana/buffer-layout";
import { toBigIntBE, toBufferBE } from "bigint-buffer";

export class UIntBE extends Layout<bigint> {
  // span is the number of bytes to read
  constructor(span: number, property?: string) {
    super(span, property);
  }

  override decode(b: Uint8Array, offset?: number): bigint {
    let o = offset ?? 0;
    const buffer = Buffer.from(b.slice(o, o + this.span));
    return toBigIntBE(buffer);
  }

  override encode(src: bigint, b: Uint8Array, offset?: number): number {
    const buffer = toBufferBE(src, this.span);
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
export function u64be(property?: string | undefined): UIntBE {
  return new UIntBE(8, property);
}

/** A big-endian u256, returned as a bigint. */
export function u256be(property?: string | undefined): UIntBE {
  return new UIntBE(32, property);
}

/** An array of numBytes bytes, returned as a hexadecimal string. */
export function hexBytes(
  numBytes: number,
  property?: string | undefined,
): HexBytes {
  return new HexBytes(numBytes, property);
}
