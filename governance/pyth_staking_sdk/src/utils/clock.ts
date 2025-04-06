import { Connection } from "@solana/web3.js";

import { EPOCH_DURATION } from "../constants.js";

export const getCurrentSolanaTimestamp = async (connection: Connection) => {
  const slot = await connection.getSlot("finalized");
  const blockTime = await connection.getBlockTime(slot);
  if (blockTime === null) {
    throw new Error("Block time is not available");
  }
  return BigInt(blockTime);
};

export const getCurrentEpoch: (
  connection: Connection,
) => Promise<bigint> = async (connection: Connection) => {
  const timestamp = await getCurrentSolanaTimestamp(connection);
  return timestamp / EPOCH_DURATION;
};

export const epochToDate = (epoch: bigint): Date => {
  return new Date(Number(epoch * EPOCH_DURATION * 1000n));
};
