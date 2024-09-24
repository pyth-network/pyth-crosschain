import { BorshCoder } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import { convertBNToBigInt } from "./bn";
import type { Staking } from "../../types/staking";
import {
  POSITION_BUFFER_SIZE,
  POSITIONS_ACCOUNT_HEADER_SIZE,
} from "../constants";
import {
  type Position,
  type PositionAnchor,
  PositionState,
  type StakeAccountPositions,
  type TargetWithParameters,
} from "../types";

export const getPositionState = (
  position: Position,
  currentEpoch: bigint,
): PositionState => {
  if (currentEpoch < position.activationEpoch) {
    return PositionState.LOCKING;
  }
  if (!position.unlockingStart) {
    return PositionState.LOCKED;
  }
  const hasActivated = position.activationEpoch <= currentEpoch;
  const unlockStarted = position.unlockingStart <= currentEpoch;
  const unlockEnded = position.unlockingStart + 1n <= currentEpoch;

  if (hasActivated && !unlockStarted) {
    return PositionState.PREUNLOCKING;
  } else if (unlockStarted && !unlockEnded) {
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
    (data.length - POSITIONS_ACCOUNT_HEADER_SIZE) / POSITION_BUFFER_SIZE,
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

export const getVotingTokenAmount = (
  stakeAccountPositions: StakeAccountPositions,
  epoch: bigint,
) => {
  const positions = stakeAccountPositions.data.positions;
  const votingPositions = positions
    .filter((p) => p.targetWithParameters.voting)
    .filter((p) =>
      [PositionState.LOCKED, PositionState.PREUNLOCKING].includes(
        getPositionState(p, epoch),
      ),
    );
  const totalVotingTokenAmount = votingPositions.reduce(
    (sum, p) => sum + p.amount,
    0n,
  );
  return totalVotingTokenAmount;
};
