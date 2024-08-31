import { BN } from "@coral-xyz/anchor";
import { Position, PositionState } from "../types";
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

export const getPositionState = (
  position: Position,
  current_epoch: bigint
): PositionState => {
  if (current_epoch < position.activationEpoch) {
    return PositionState.LOCKING;
  }
  if (!position.unlockingStart) {
    return PositionState.LOCKED;
  }
  const has_activated = position.activationEpoch <= current_epoch;
  const unlock_started = position.unlockingStart <= current_epoch;
  const unlock_ended = position.unlockingStart + 1n <= current_epoch;

  if (has_activated && !unlock_started) {
    return PositionState.PREUNLOCKING;
  } else if (unlock_started && !unlock_ended) {
    return PositionState.UNLOCKING;
  } else {
    return PositionState.UNLOCKED;
  }
};
