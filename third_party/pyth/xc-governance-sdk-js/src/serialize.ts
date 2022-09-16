export interface Serializable {
  serialize(): Uint8Array;
}

export class SerializeUtils {
  static concat(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((prev, cur) => (prev + cur.length), 0);

    const result = new Uint8Array(totalLength);

    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }

    return result;
  }

  static serializeUint8(value: number): Uint8Array {
    const result = new ArrayBuffer(1);
    const dv = new DataView(result);
    dv.setUint8(0, value);
    return new Uint8Array(result);
  }

  static serializeUint16(value: number): Uint8Array {
    const result = new ArrayBuffer(2);
    const dv = new DataView(result);
    dv.setUint16(0, value);
    return new Uint8Array(result);
  }

  static serializeUint32(value: number): Uint8Array {
    const result = new ArrayBuffer(4);
    const dv = new DataView(result);
    dv.setUint32(0, value);
    return new Uint8Array(result);
  }

  static serializeBigUint64(value: bigint): Uint8Array {
    const result = new ArrayBuffer(8);
    const dv = new DataView(result);
    dv.setBigUint64(0, value);
    return new Uint8Array(result);
  }

  static serializeBigUint256(value: bigint): Uint8Array {
    const result = new ArrayBuffer(32);
    const dv = new DataView(result);

    const MASK_64_BIT = ((BigInt(1) << BigInt(64)) - BigInt(1));
    let revOffset = 32;
    for (let i = 0; i < 4; i++) {
      const chunk = value & MASK_64_BIT;
      dv.setBigUint64(revOffset - 8, chunk);

      revOffset -= 8;
      value >>= BigInt(64);
    }

    if (value !== BigInt(0)) {
      throw new Error("Invalid 256-bit bigint");
    }

    return new Uint8Array(result);
  }
}
