const ACCUMULATOR_MAGIC = "504e4155";
const MAJOR_VERSION = 1;
const MINOR_VERSION = 0;
const KECCAK160_HASH_SIZE = 20;

export type AccumulatorUpdateData = {
  vaa: Buffer;
  updates: { message: Buffer; proof: Buffer[] }[];
};

export function isAccumulatorUpdateData(updateBytes: Buffer): boolean {
  return (
    updateBytes.toString("hex").slice(0, 8) === ACCUMULATOR_MAGIC &&
    updateBytes[4] === MAJOR_VERSION &&
    updateBytes[5] === MINOR_VERSION
  );
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
