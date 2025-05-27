import type { UnlockSchedule, VestingSchedule } from "../types.js";

export const getUnlockSchedule = (options: {
  pythTokenListTime: bigint;
  vestingSchedule: VestingSchedule;
  includePastPeriods: boolean;
}): UnlockSchedule => {
  const { vestingSchedule, pythTokenListTime, includePastPeriods } = options;

  if (vestingSchedule.fullyVested) {
    return {
      type: "fullyUnlocked",
      schedule: [],
    };
  } else if (vestingSchedule.periodicVestingAfterListing) {
    return {
      type: "periodicUnlockingAfterListing",
      schedule: getPeriodicUnlockSchedule({
        balance: vestingSchedule.periodicVestingAfterListing.initialBalance,
        numPeriods: vestingSchedule.periodicVestingAfterListing.numPeriods,
        periodDuration:
          vestingSchedule.periodicVestingAfterListing.periodDuration,
        startDate: pythTokenListTime,
        includePastPeriods,
      }),
    };
  } else {
    return {
      type: "periodicUnlocking",
      schedule: getPeriodicUnlockSchedule({
        balance: vestingSchedule.periodicVesting.initialBalance,
        numPeriods: vestingSchedule.periodicVesting.numPeriods,
        periodDuration: vestingSchedule.periodicVesting.periodDuration,
        startDate: vestingSchedule.periodicVesting.startDate,
        includePastPeriods,
      }),
    };
  }
};

export const getPeriodicUnlockSchedule = (options: {
  balance: bigint;
  startDate: bigint;
  periodDuration: bigint;
  numPeriods: bigint;
  includePastPeriods: boolean;
}): UnlockSchedule["schedule"] => {
  const { balance, startDate, periodDuration, numPeriods, includePastPeriods } =
    options;

  const unlockSchedule: UnlockSchedule["schedule"] = [];
  const currentTimeStamp = Date.now() / 1000;

  for (let i = 0; i < numPeriods; i++) {
    const unlockTimeStamp =
      Number(startDate) + Number(periodDuration) * (i + 1);
    if (currentTimeStamp < unlockTimeStamp || includePastPeriods) {
      unlockSchedule.push({
        date: new Date(unlockTimeStamp * 1000),
        amount:
          ((numPeriods - BigInt(i)) * balance) / numPeriods -
          ((numPeriods - BigInt(i + 1)) * balance) / numPeriods,
      });
    }
  }

  return unlockSchedule;
};
