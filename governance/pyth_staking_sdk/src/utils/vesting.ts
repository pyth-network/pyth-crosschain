import type { UnlockSchedule, VestingSchedule } from "../types";

export const getUnlockSchedule = (options: {
  pythTokenListTime: bigint;
  vestingSchedule: VestingSchedule;
}): UnlockSchedule => {
  const { vestingSchedule, pythTokenListTime } = options;

  if (vestingSchedule.fullyVested) {
    return [];
  } else if (vestingSchedule.periodicVestingAfterListing) {
    return getPeriodicUnlockSchedule({
      balance: vestingSchedule.periodicVestingAfterListing.initialBalance,
      numPeriods: vestingSchedule.periodicVestingAfterListing.numPeriods,
      periodDuration:
        vestingSchedule.periodicVestingAfterListing.periodDuration,
      startDate: pythTokenListTime,
    });
  } else {
    return getPeriodicUnlockSchedule({
      balance: vestingSchedule.periodicVesting.initialBalance,
      numPeriods: vestingSchedule.periodicVesting.numPeriods,
      periodDuration: vestingSchedule.periodicVesting.periodDuration,
      startDate: vestingSchedule.periodicVesting.startDate,
    });
  }
};

export const getPeriodicUnlockSchedule = (options: {
  balance: bigint;
  startDate: bigint;
  periodDuration: bigint;
  numPeriods: bigint;
}): UnlockSchedule => {
  const { balance, startDate, periodDuration, numPeriods } = options;

  const unlockSchedule: UnlockSchedule = [];
  const currentTimeStamp = Date.now() / 1000;

  for (let i = 0; i < numPeriods; i++) {
    const unlockTimeStamp =
      Number(startDate) + Number(periodDuration) * (i + 1);
    if (currentTimeStamp < unlockTimeStamp) {
      unlockSchedule.push({
        date: new Date(unlockTimeStamp * 1000),
        amount: balance / numPeriods,
      });
    }
  }

  return unlockSchedule;
};
