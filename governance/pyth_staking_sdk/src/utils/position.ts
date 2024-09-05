import { BorshCoder } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import { convertBNToBigInt } from "./bn";
import type { Staking } from "../../types/staking";
import { POSITION_BUFFER_SIZE, POSITIONS_ACCOUNT_SIZE } from "../constants";
import {
  type Position,
  type PositionAnchor,
  PositionState,
  type StakeAccountPositions,
  type TargetWithParameters,
} from "../types";

export const getPositionState = (
  position: Position,
  current_epoch: bigint,
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

export const getAmountByTargetAndState = (options: {
  stakeAccountPositions: StakeAccountPositions;
  targetWithParameters: TargetWithParameters;
  positionState: PositionState;
  epoch: bigint;
}): bigint => {
  const { stakeAccountPositions, targetWithParameters, positionState, epoch } =
    options;

  return stakeAccountPositions.data.positions
    .filter((p) => getPositionState(p, epoch) === positionState)
    .filter((p) => {
      if (targetWithParameters.voting) {
        return p.targetWithParameters.voting !== undefined;
      }
      return (
        p.targetWithParameters.integrityPool?.publisher &&
        targetWithParameters.integrityPool.publisher.equals(
          p.targetWithParameters.integrityPool.publisher,
        )
      );
    })
    .map((p) => p.amount)
    .reduce((sum, amount) => sum + amount, 0n);
};

export const deserializeStakeAccountPositions = (
  address: PublicKey,
  data: Buffer,
  idl: Staking,
) => {
  const coder = new BorshCoder(idl);
  let i = 8; // Skip discriminator
  const owner = new PublicKey(data.slice(i, i + 32));
  const numberOfPositions = Math.floor(
    (data.length - POSITIONS_ACCOUNT_SIZE) / POSITION_BUFFER_SIZE,
  );
  i += 32;
  const positions: PositionAnchor[] = [];
  for (let j = 0; j < numberOfPositions; j++) {
    if (data[i] === 1) {
      positions.push(coder.types.decode("position", data.subarray(i + 1)));
    }
    i += POSITION_BUFFER_SIZE;
  }

  return {
    address,
    data: {
      owner,
      positions: positions.map((p) => convertBNToBigInt(p)),
    },
  };
};
