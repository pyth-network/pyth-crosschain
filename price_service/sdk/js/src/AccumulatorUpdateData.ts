import BN from "bn.js";

const ACCUMULATOR_MAGIC = "504e4155";
const MAJOR_VERSION = 1;
const MINOR_VERSION = 0;
const KECCAK160_HASH_SIZE = 20;
const PRICE_FEED_MESSAGE_VARIANT = 0;

export type AccumulatorUpdateData = {
  vaa: Buffer;
  updates: { message: Buffer; proof: Buffer[] }[];
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

export function parseAccumulatorUpdateData(
  data: Buffer
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
      proof.push(data.subarray(cursor, cursor + KECCAK160_HASH_SIZE));
      cursor += KECCAK160_HASH_SIZE;
    }

    updates.push({ message, proof });
  }

  if (cursor !== data.length) {
    throw new Error("Didn't reach the end of the message");
  }

  return { vaa, updates };
}
