import type { StakeAccountPositions } from "../staking/accounts";
import {
  type Position,
  PositionState,
  type TargetWithParameters,
} from "../types";

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

export const getAmountByTargetAndState = (options: {
  stakeAccountPositions: StakeAccountPositions;
  targetWithParameters: TargetWithParameters;
  positionState: PositionState;
  epoch: bigint;
}): bigint => {
  const { stakeAccountPositions, targetWithParameters, positionState, epoch } =
    options;

  return stakeAccountPositions.data.positions
    .filter((p) => p && getPositionState(p, epoch) === positionState)
    .filter((p) => {
      if (targetWithParameters.voting) {
        return !!p?.targetWithParameters.voting;
      }
      return (
        targetWithParameters?.integrityPool?.publisher ===
        p?.targetWithParameters?.integrityPool?.publisher
      );
    })
    .map((p) => p!.amount)
    .reduce((sum, amount) => sum + amount, 0n);
};
