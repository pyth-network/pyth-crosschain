import { UnlockSchedule, VestingSchedule } from "../types";

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
  } else if (vestingSchedule.periodicVesting) {
    return getPeriodicUnlockSchedule({
      balance: vestingSchedule.periodicVesting.initialBalance,
      numPeriods: vestingSchedule.periodicVesting.numPeriods,
      periodDuration: vestingSchedule.periodicVesting.periodDuration,
      startDate: vestingSchedule.periodicVesting.startDate,
    });
  }
  assertNever(vestingSchedule);
};

export const getPeriodicUnlockSchedule = (options: {
  balance: bigint;
  startDate: bigint;
  periodDuration: bigint;
  numPeriods: bigint;
}): UnlockSchedule => {
  const { balance, startDate, periodDuration, numPeriods } = options;

  const unlockSchedule: UnlockSchedule = [];
  const currentTimeStamp = new Date().getTime() / 1000;

  for (let i = 0; i < numPeriods; i++) {
    const unlockTimeStamp =
      Number(startDate) + Number(periodDuration) * (i + 1);
    console.debug("Unlock timestamp", unlockTimeStamp);
    if (currentTimeStamp < unlockTimeStamp) {
      unlockSchedule.push({
        date: new Date(unlockTimeStamp * 1000),
        amount: balance / numPeriods,
      });
    }
  }

  return unlockSchedule;
};

// Utility function to assert a value is never
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
