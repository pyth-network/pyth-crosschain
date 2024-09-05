import { Connection } from "@solana/web3.js";

import { EPOCH_DURATION } from "../constants";

export const getCurrentSolanaTimestamp = async (connection: Connection) => {
  const slot = await connection.getSlot();
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
