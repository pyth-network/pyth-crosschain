import { FRACTION_PRECISION } from "../constants";

export const convertEpochYieldToApy = (epochYield: bigint) => {
  return (Number(epochYield) * 52 * 100) / FRACTION_PRECISION;
};

export const calculateApy = (
  options: {
    selfStake: bigint;
    poolCapacity: bigint;
    yieldRate: bigint;
  } & ({ isSelf: true } | { isSelf: false; poolUtilization: bigint }),
) => {
  const { selfStake, poolCapacity, yieldRate, isSelf } = options;
  const eligibleSelfStake = selfStake > poolCapacity ? poolCapacity : selfStake;

  const apyPercentage = convertEpochYieldToApy(yieldRate);

  if (isSelf) {
    if (selfStake === 0n) {
      return apyPercentage;
    }
    return (apyPercentage * Number(eligibleSelfStake)) / Number(selfStake);
  }

  const { poolUtilization } = options;

  const delegatorPoolUtilization = poolUtilization - selfStake;
  const delegatorPoolCapacity = poolCapacity - eligibleSelfStake;
  const eligibleStake =
    delegatorPoolUtilization > delegatorPoolCapacity
      ? delegatorPoolCapacity
      : delegatorPoolUtilization;

  if (poolUtilization === selfStake) {
    return apyPercentage;
  }

  return (
    (apyPercentage * Number(eligibleStake)) / Number(delegatorPoolUtilization)
  );
};
