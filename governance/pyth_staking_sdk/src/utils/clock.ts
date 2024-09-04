import { BN } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { EPOCH_DURATION } from "../constants";

export const getCurrentSolanaTimestamp = async (connection: Connection) => {
  const slot = await connection.getSlot();
  const blockTime = await connection.getBlockTime(slot);
  return new BN(blockTime!);
};

export const getCurrentEpoch: (
  connection: Connection
) => Promise<bigint> = async (connection: Connection) => {
  const timestampBN = await getCurrentSolanaTimestamp(connection);
  const timestamp = BigInt(timestampBN.toString());
  return timestamp / EPOCH_DURATION;
};
