import type { UnlockSchedule, VestingSchedule } from "../types.js";

export const getUnlockSchedule = (options: {
  pythTokenListTime: bigint;
  vestingSchedule: VestingSchedule;
  includePastPeriods: boolean;
}): UnlockSchedule => {
  const { vestingSchedule, pythTokenListTime, includePastPeriods } = options;

  if (vestingSchedule.fullyVested) {
    return {
      schedule: [],
      type: "fullyUnlocked",
    };
  } else if (vestingSchedule.periodicVestingAfterListing) {
    return {
      schedule: getPeriodicUnlockSchedule({
        balance: vestingSchedule.periodicVestingAfterListing.initialBalance,
        includePastPeriods,
        numPeriods: vestingSchedule.periodicVestingAfterListing.numPeriods,
        periodDuration:
          vestingSchedule.periodicVestingAfterListing.periodDuration,
        startDate: pythTokenListTime,
      }),
      type: "periodicUnlockingAfterListing",
    };
  } else {
    return {
      schedule: getPeriodicUnlockSchedule({
        balance: vestingSchedule.periodicVesting.initialBalance,
        includePastPeriods,
        numPeriods: vestingSchedule.periodicVesting.numPeriods,
        periodDuration: vestingSchedule.periodicVesting.periodDuration,
        startDate: vestingSchedule.periodicVesting.startDate,
      }),
      type: "periodicUnlocking",
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
        amount:
          ((numPeriods - BigInt(i)) * balance) / numPeriods -
          ((numPeriods - BigInt(i + 1)) * balance) / numPeriods,
        date: new Date(unlockTimeStamp * 1000),
      });
    }
  }

  return unlockSchedule;
};
