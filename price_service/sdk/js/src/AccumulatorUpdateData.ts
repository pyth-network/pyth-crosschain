import BN from "bn.js";

const ACCUMULATOR_MAGIC = "504e4155";
const MAJOR_VERSION = 1;
const MINOR_VERSION = 0;
const KECCAK160_HASH_SIZE = 20;
const PRICE_FEED_MESSAGE_VARIANT = 0;
const TWAP_MESSAGE_VARIANT = 1;

export type AccumulatorUpdateData = {
  vaa: Buffer;
  updates: { message: Buffer; proof: number[][] }[];
};
export type PriceFeedMessage = {
  feedId: Buffer;
  price: BN;
  confidence: BN;
  exponent: number;
  publishTime: BN;
  prevPublishTime: BN;
  emaPrice: BN;
  emaConf: BN;
};

export type TwapMessage = {
  feedId: Buffer;
  cumulativePrice: BN;
  cumulativeConf: BN;
  numDownSlots: BN;
  exponent: number;
  publishTime: BN;
  prevPublishTime: BN;
  publishSlot: BN;
};

export function isAccumulatorUpdateData(updateBytes: Buffer): boolean {
  return (
    updateBytes.toString("hex").slice(0, 8) === ACCUMULATOR_MAGIC &&
    updateBytes[4] === MAJOR_VERSION &&
    updateBytes[5] === MINOR_VERSION
  );
}

export function parsePriceFeedMessage(message: Buffer): PriceFeedMessage {
  let cursor = 0;
  const variant = message.readUInt8(cursor);
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
  const exponent = message.readInt32BE(cursor);
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

export function parseTwapMessage(message: Buffer): TwapMessage {
  let cursor = 0;
  const variant = message.readUInt8(cursor);
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
  const exponent = message.readInt32BE(cursor);
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
export function sliceAccumulatorUpdateData(
  data: Buffer,
  start?: number,
  end?: number,
): Buffer {
  if (!isAccumulatorUpdateData(data)) {
    throw new Error("Invalid accumulator message");
  }
  let cursor = 6;
  const trailingPayloadSize = data.readUint8(cursor);
  cursor += 1 + trailingPayloadSize;

  // const proofType = data.readUint8(cursor);
  cursor += 1;

  const vaaSize = data.readUint16BE(cursor);
  cursor += 2;
  cursor += vaaSize;

  const endOfVaa = cursor;

  const updates = [];
  const numUpdates = data.readUInt8(cursor);
  cursor += 1;

  for (let i = 0; i < numUpdates; i++) {
    const updateStart = cursor;
    const messageSize = data.readUint16BE(cursor);
    cursor += 2;
    cursor += messageSize;

    const numProofs = data.readUInt8(cursor);
    cursor += 1;
    cursor += KECCAK160_HASH_SIZE * numProofs;

    updates.push(data.subarray(updateStart, cursor));
  }

  if (cursor !== data.length) {
    throw new Error("Didn't reach the end of the message");
  }

  const sliceUpdates = updates.slice(start, end);
  return Buffer.concat([
    data.subarray(0, endOfVaa),
    Buffer.from([sliceUpdates.length]),
    ...updates.slice(start, end),
  ]);
}

export function parseAccumulatorUpdateData(
  data: Buffer,
): AccumulatorUpdateData {
  if (!isAccumulatorUpdateData(data)) {
    throw new Error("Invalid accumulator message");
  }

  let cursor = 6;
  const trailingPayloadSize = data.readUint8(cursor);
  cursor += 1 + trailingPayloadSize;

  // const proofType = data.readUint8(cursor);
  cursor += 1;

  const vaaSize = data.readUint16BE(cursor);
  cursor += 2;

  const vaa = data.subarray(cursor, cursor + vaaSize);
  cursor += vaaSize;

  const numUpdates = data.readUInt8(cursor);
  const updates = [];
  cursor += 1;

  for (let i = 0; i < numUpdates; i++) {
    const messageSize = data.readUint16BE(cursor);
    cursor += 2;
    const message = data.subarray(cursor, cursor + messageSize);
    cursor += messageSize;

    const numProofs = data.readUInt8(cursor);
    cursor += 1;
    const proof = [];
    for (let j = 0; j < numProofs; j++) {
      proof.push(
        Array.from(data.subarray(cursor, cursor + KECCAK160_HASH_SIZE)),
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
