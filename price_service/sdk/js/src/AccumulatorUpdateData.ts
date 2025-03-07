import BN from "bn.js";
import type { Buffer } from "buffer";

const ACCUMULATOR_MAGIC = "504e4155";
const MAJOR_VERSION = 1;
const MINOR_VERSION = 0;
const KECCAK160_HASH_SIZE = 20;
const PRICE_FEED_MESSAGE_VARIANT = 0;
const TWAP_MESSAGE_VARIANT = 1;

export type AccumulatorUpdateData<T extends Uint8ArrayLike = Buffer> = {
  vaa: T;
  updates: { message: T; proof: number[][] }[];
};
export type PriceFeedMessage<T extends Uint8ArrayLike = Buffer> = {
  feedId: T;
  price: BN;
  confidence: BN;
  exponent: number;
  publishTime: BN;
  prevPublishTime: BN;
  emaPrice: BN;
  emaConf: BN;
};

export type TwapMessage<T extends Uint8ArrayLike = Buffer> = {
  feedId: T;
  cumulativePrice: BN;
  cumulativeConf: BN;
  numDownSlots: BN;
  exponent: number;
  publishTime: BN;
  prevPublishTime: BN;
  publishSlot: BN;
};

export function isAccumulatorUpdateData<T extends Uint8ArrayLike>(
  updateBytes: T
): boolean {
  return (
    toHex(updateBytes).slice(0, 8) === ACCUMULATOR_MAGIC &&
    updateBytes[4] === MAJOR_VERSION &&
    updateBytes[5] === MINOR_VERSION
  );
}

export function parsePriceFeedMessage<T extends Uint8ArrayLike>(
  message: T
): PriceFeedMessage<T> {
  let cursor = 0;
  const dataView = getDataView(message);
  const variant = dataView.getUint8(cursor);
  if (variant !== PRICE_FEED_MESSAGE_VARIANT) {
    throw new Error("Not a price feed message");
  }
  cursor += 1;
  const feedId = message.subarray(cursor, cursor + 32);
  cursor += 32;
  const price = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  const confidence = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  const exponent = dataView.getInt32(cursor);
  cursor += 4;
  const publishTime = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  const prevPublishTime = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  const emaPrice = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  const emaConf = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  return {
    feedId,
    price,
    confidence,
    exponent,
    publishTime,
    prevPublishTime,
    emaPrice,
    emaConf,
  };
}

export function parseTwapMessage<T extends Uint8ArrayLike>(
  message: T
): TwapMessage<T> {
  let cursor = 0;
  const dataView = getDataView(message);
  const variant = dataView.getUint8(cursor);
  if (variant !== TWAP_MESSAGE_VARIANT) {
    throw new Error("Not a twap message");
  }
  cursor += 1;
  const feedId = message.subarray(cursor, cursor + 32);
  cursor += 32;
  const cumulativePrice = new BN(message.subarray(cursor, cursor + 16), "be");
  cursor += 16;
  const cumulativeConf = new BN(message.subarray(cursor, cursor + 16), "be");
  cursor += 16;
  const numDownSlots = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  const exponent = dataView.getInt32(cursor);
  cursor += 4;
  const publishTime = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  const prevPublishTime = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  const publishSlot = new BN(message.subarray(cursor, cursor + 8), "be");
  cursor += 8;
  return {
    feedId,
    cumulativePrice,
    cumulativeConf,
    numDownSlots,
    exponent,
    publishTime,
    prevPublishTime,
    publishSlot,
  };
}

/**
 * An AccumulatorUpdateData contains a VAA and a list of updates. This function returns a new serialized AccumulatorUpdateData with only the updates in the range [start, end).
 */
export function sliceAccumulatorUpdateData<T extends Uint8ArrayLike>(
  data: T,
  start?: number,
  end?: number
): T {
  if (!isAccumulatorUpdateData(data)) {
    throw new Error("Invalid accumulator message");
  }
  let cursor = 6;
  const dataView = getDataView(data);
  const trailingPayloadSize = dataView.getUint8(cursor);
  cursor += 1 + trailingPayloadSize;

  // const proofType = data.readUint8(cursor);
  cursor += 1;

  const vaaSize = dataView.getUint16(cursor);
  cursor += 2;
  cursor += vaaSize;

  const endOfVaa = cursor;

  const updates = [];
  const numUpdates = dataView.getUint8(cursor);
  cursor += 1;

  for (let i = 0; i < numUpdates; i++) {
    const updateStart = cursor;
    const messageSize = dataView.getUint16(cursor);
    cursor += 2;
    cursor += messageSize;

    const numProofs = dataView.getUint8(cursor);
    cursor += 1;
    cursor += KECCAK160_HASH_SIZE * numProofs;

    updates.push(data.subarray(updateStart, cursor));
  }

  if (cursor !== data.length) {
    throw new Error("Didn't reach the end of the message");
  }

  const sliceUpdates = updates.slice(start, end);
  return mergeUint8ArrayLikes([
    data.subarray(0, endOfVaa),
    fromAsTypeOf(data, [sliceUpdates.length]),
    ...updates.slice(start, end),
  ]);
}

export function parseAccumulatorUpdateData<T extends Uint8ArrayLike>(
  data: T
): AccumulatorUpdateData<T> {
  if (!isAccumulatorUpdateData(data)) {
    throw new Error("Invalid accumulator message");
  }

  let cursor = 6;
  const dataView = getDataView(data);
  const trailingPayloadSize = dataView.getUint8(cursor);
  cursor += 1 + trailingPayloadSize;

  // const proofType = data.getUint8(cursor);
  cursor += 1;

  const vaaSize = dataView.getUint16(cursor);
  cursor += 2;

  const vaa = data.subarray(cursor, cursor + vaaSize);
  cursor += vaaSize;

  const numUpdates = dataView.getUint8(cursor);
  const updates = [];
  cursor += 1;

  for (let i = 0; i < numUpdates; i++) {
    const messageSize = dataView.getUint16(cursor);
    cursor += 2;
    const message = data.subarray(cursor, cursor + messageSize);
    cursor += messageSize;

    const numProofs = dataView.getUint8(cursor);
    cursor += 1;
    const proof = [];
    for (let j = 0; j < numProofs; j++) {
      proof.push(
        Array.from(data.subarray(cursor, cursor + KECCAK160_HASH_SIZE))
      );
      cursor += KECCAK160_HASH_SIZE;
    }

    updates.push({ message, proof });
  }

  if (cursor !== data.length) {
    throw new Error("Didn't reach the end of the message");
  }

  return { vaa, updates };
}

function mergeUint8ArrayLikes<T extends Uint8ArrayLike>(
  inputs: [T, ...T[]]
): T {
  const out = createAsTypeOf(
    inputs[0],
    inputs.reduce((acc, arr) => acc + arr.length, 0)
  );
  let offset = 0;
  for (const arr of inputs) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function toHex(input: Uint8ArrayLike): string {
  return Array.from(input)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

// With Uint8Arrays, we could just do `new DataView(buf.buffer)`.  But to
// account for `Buffers`, we need to slice to the used space since `Buffers` may
// be allocated to be larger than needed.
function getDataView(buf: Uint8ArrayLike) {
  return new DataView(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );
}

// This is a little bit of a typescript hack -- we know that `Buffer.from` and
// `Uint8Array.from` behave effectively the same and we just want a `from` which
// will return either a `Uint8Array` or a `Buffer`, depending on the type of
// some other variable.  But typescript sucks at typechecking prototypes so
// there's really no other good way I'm aware of to do this besides a bit of
// typecasting through `any`.
function fromAsTypeOf<T extends Uint8ArrayLike>(
  buf: T,
  ...args: Parameters<typeof Uint8Array.from>
) {
  return Object.getPrototypeOf(buf.constructor).from(...args) as T;
}

// Similar to `fromAsTypeOf`, here we want to be able to create either a
// `Buffer` or a `Uint8Array`, matching the type of a passed in value.  But this
// is a bit more complex, because for `Uint8Array` we should do that with the
// `Uint8Array` constructor, where for `Buffer` we should do that using
// `Buffer.alloc`.  This is a bit of a weird hack but I don't know a better way
// to make typescript handle such cases.
function createAsTypeOf<T extends Uint8ArrayLike>(buf: T, size: number) {
  const ctor = buf.constructor;
  const create = ("alloc" in ctor ? ctor.alloc : ctor) as (size: number) => T;
  return create(size);
}

interface Uint8ArrayLike extends Uint8Array {
  subarray: (from: number, to: number) => this;
}
