import { FRACTION_PRECISION } from "../constants";

export const convertEpochYieldToApy = (epochYield: bigint) => {
  return (Number(epochYield) * 52 * 100) / FRACTION_PRECISION;
};

export const computeDelegatorPercentage = (
  delegationFee : bigint,
) => {
  return 1 - Number(delegationFee) / FRACTION_PRECISION;
}

export const calculateApy = (
  options: {
    selfStake: bigint;
    poolCapacity: bigint;
    yieldRate: bigint;
    delegationFee : bigint;
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
  const delegatorPercentage = computeDelegatorPercentage(options.delegationFee);

  const delegatorPoolUtilization = poolUtilization - selfStake;
  const delegatorPoolCapacity = poolCapacity - eligibleSelfStake;
  const eligibleStake =
    delegatorPoolUtilization > delegatorPoolCapacity
      ? delegatorPoolCapacity
      : delegatorPoolUtilization;

  if (poolUtilization === selfStake) {
    return (selfStake >= poolCapacity ? 0 : apyPercentage) * delegatorPercentage;
  }

  return (
    (apyPercentage * delegatorPercentage * Number(eligibleStake)) / Number(delegatorPoolUtilization)
  );
};
