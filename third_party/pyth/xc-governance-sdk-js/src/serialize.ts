export interface Serializable {
  serialize(): Buffer;
}

export class BufferBuilder {
  private items: Buffer[];

  constructor() {
    this.items = [];
  }

  addUint8(value: number): BufferBuilder {
    const buffer = Buffer.alloc(1);
    buffer.writeUint8(value);
    this.items.push(buffer);
    return this;
  }

  addUint16(value: number): BufferBuilder {
    const buffer = Buffer.alloc(2);
    buffer.writeUint16BE(value);
    this.items.push(buffer);
    return this;
  }

  addUint32(value: number): BufferBuilder {
    const buffer = Buffer.alloc(4);
    buffer.writeUint32BE(value);
    this.items.push(buffer);
    return this;
  }

  addBigUint64(value: bigint): BufferBuilder {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(value);
    this.items.push(buffer);
    return this;
  }

  addObject(obj: Serializable): BufferBuilder {
    this.items.push(obj.serialize());
    return this;
  }

  addBuffer(buffer: Buffer): BufferBuilder {
    this.items.push(buffer);
    return this;
  }

  build(): Buffer {
    const totalLength = this.items.reduce((prev, cur) => prev + cur.length, 0);

    const result = Buffer.alloc(totalLength);

    let offset = 0;
    for (const arr of this.items) {
      result.set(arr, offset);
      offset += arr.length;
    }

    return result;
  }
}
