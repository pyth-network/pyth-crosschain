import { Layout } from "@solana/buffer-layout";

export class UInt64BE extends Layout<bigint> {
  constructor(span: number, property?: string) {
    super(span, property);
  }

  override decode(b: Uint8Array, offset?: number): bigint {
    return Buffer.from(b.slice(offset, this.span)).readBigUInt64BE();
  }

  override encode(src: bigint, b: Uint8Array, offset?: number): number {
    const buffer = Buffer.alloc(this.span);
    buffer.writeBigUint64BE(src);

    b.set(buffer, offset);

    return this.span;
  }
}

export function u64be(property?: string | undefined): UInt64BE {
  return new UInt64BE(8, property);
}
