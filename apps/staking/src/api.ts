import type { HermesClient, PublisherCaps } from "@pythnetwork/hermes-client";
import { lookup } from "@pythnetwork/known-publishers";
import type { StakeAccountPositions } from "@pythnetwork/staking-sdk";
import {
  epochToDate,
  extractPublisherData,
  getAmountByTargetAndState,
  getCurrentEpoch,
  PositionState,
  PythnetClient,
  PythStakingClient,
} from "@pythnetwork/staking-sdk";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

const publishersRankingSchema = z
  .object({
    publisher: z.string(),
    rank: z.number(),
    numSymbols: z.number(),
    timestamp: z.string(),
  })
  .array();

type Data = {
  total: bigint;
  availableRewards: bigint;
  currentEpoch: bigint;
  lastSlash:
    | {
        amount: bigint;
        date: Date;
      }
    | undefined;
  expiringRewards: Date | undefined;
  unlockSchedule: {
    date: Date;
    amount: bigint;
  }[];
  walletAmount: bigint;
  governance: {
    warmup: bigint;
    staked: bigint;
    cooldown: bigint;
    cooldown2: bigint;
  };
  yieldRate: bigint;
  m: bigint;
  z: bigint;
  integrityStakingPublishers: {
    identity: ReturnType<typeof lookup>;
    publicKey: PublicKey;
    stakeAccount: PublicKey | undefined;
    selfStake: bigint;
    selfStakeDelta: bigint;
    poolCapacity: bigint;
    poolUtilization: bigint;
    poolUtilizationDelta: bigint;
    numFeeds: number;
    qualityRanking: number;
    delegationFee: bigint;
    apyHistory: { date: Date; apy: number; selfApy: number }[];
    positions?:
      | {
          warmup?: bigint | undefined;
          staked?: bigint | undefined;
          cooldown?: bigint | undefined;
          cooldown2?: bigint | undefined;
        }
      | undefined;
  }[];
};

export enum StakeType {
  Governance,
  IntegrityStaking,
}

const StakeDetails = {
  Governance: () => ({ type: StakeType.Governance as const }),
  IntegrityStaking: (publisherName: string) => ({
    type: StakeType.IntegrityStaking as const,
    publisherName,
  }),
};

export type StakeDetails = ReturnType<
  (typeof StakeDetails)[keyof typeof StakeDetails]
>;

export const getAllStakeAccountAddresses = async (
  client: PythStakingClient,
): Promise<PublicKey[]> => client.getAllStakeAccountPositions();

export const getStakeAccount = async (
  client: PythStakingClient,
  stakeAccountAddress: PublicKey,
): Promise<StakeAccountPositions> =>
  client.getStakeAccountPositions(stakeAccountAddress);

export const loadData = async (
  client: PythStakingClient,
  pythnetClient: PythnetClient,
  hermesClient: HermesClient,
  stakeAccount?: PublicKey,
  simulationPayer?: PublicKey,
): Promise<Data> =>
  stakeAccount === undefined
    ? loadDataNoStakeAccount(client, pythnetClient, hermesClient)
    : loadDataForStakeAccount(
        client,
        pythnetClient,
        hermesClient,
        stakeAccount,
        simulationPayer,
      );

const loadDataNoStakeAccount = async (
  client: PythStakingClient,
  pythnetClient: PythnetClient,
  hermesClient: HermesClient,
): Promise<Data> => {
  const { publishers, ...baseInfo } = await loadBaseInfo(
    client,
    pythnetClient,
    hermesClient,
  );

  return {
    ...baseInfo,
    lastSlash: undefined,
    availableRewards: 0n,
    expiringRewards: undefined,
    total: 0n,
    governance: {
      warmup: 0n,
      staked: 0n,
      cooldown: 0n,
      cooldown2: 0n,
    },
    unlockSchedule: [],
    integrityStakingPublishers: publishers,
  };
};

const loadDataForStakeAccount = async (
  client: PythStakingClient,
  pythnetClient: PythnetClient,
  hermesClient: HermesClient,
  stakeAccount: PublicKey,
  simulationPayer?: PublicKey,
): Promise<Data> => {
  const [
    { publishers, ...baseInfo },
    stakeAccountCustody,
    unlockSchedule,
    claimableRewards,
    stakeAccountPositions,
  ] = await Promise.all([
    loadBaseInfo(client, pythnetClient, hermesClient),
    client.getStakeAccountCustody(stakeAccount),
    client.getUnlockSchedule(stakeAccount),
    client.getClaimableRewards(stakeAccount, simulationPayer),
    client.getStakeAccountPositions(stakeAccount),
  ]);

  const filterGovernancePositions = (positionState: PositionState) =>
    getAmountByTargetAndState({
      stakeAccountPositions,
      targetWithParameters: { voting: {} },
      positionState,
      epoch: baseInfo.currentEpoch,
    });

  const filterOISPositions = (
    publisher: PublicKey,
    positionState: PositionState,
  ) =>
    getAmountByTargetAndState({
      stakeAccountPositions,
      targetWithParameters: { integrityPool: { publisher } },
      positionState,
      epoch: baseInfo.currentEpoch,
    });

  return {
    ...baseInfo,
    lastSlash: undefined, // TODO
    availableRewards: claimableRewards.totalRewards,
    expiringRewards: claimableRewards.expiry,
    total: stakeAccountCustody.amount,
    governance: {
      warmup: filterGovernancePositions(PositionState.LOCKING),
      staked: filterGovernancePositions(PositionState.LOCKED),
      cooldown: filterGovernancePositions(PositionState.PREUNLOCKING),
      cooldown2: filterGovernancePositions(PositionState.UNLOCKING),
    },
    unlockSchedule: unlockSchedule.schedule,
    integrityStakingPublishers: publishers.map((publisher) => ({
      ...publisher,
      positions: {
        warmup: filterOISPositions(publisher.publicKey, PositionState.LOCKING),
        staked: filterOISPositions(publisher.publicKey, PositionState.LOCKED),
        cooldown: filterOISPositions(
          publisher.publicKey,
          PositionState.PREUNLOCKING,
        ),
        cooldown2: filterOISPositions(
          publisher.publicKey,
          PositionState.UNLOCKING,
        ),
      },
    })),
  };
};

const loadBaseInfo = async (
  client: PythStakingClient,
  pythnetClient: PythnetClient,
  hermesClient: HermesClient,
) => {
  const [publishers, walletAmount, poolConfig, currentEpoch, parameters] =
    await Promise.all([
      loadPublisherData(client, pythnetClient, hermesClient),
      client.getOwnerPythBalance(),
      client.getPoolConfigAccount(),
      getCurrentEpoch(client.connection),
      pythnetClient.getStakeCapParameters(),
    ]);

  return {
    yieldRate: poolConfig.y,
    walletAmount,
    publishers,
    currentEpoch,
    m: parameters.m,
    z: parameters.z,
  };
};

const loadPublisherData = async (
  client: PythStakingClient,
  pythnetClient: PythnetClient,
  hermesClient: HermesClient,
) => {
  const [poolData, publisherRankings, publisherCaps, publisherNumberOfSymbols] =
    await Promise.all([
      client.getPoolDataAccount(),
      getPublisherRankings(),
      hermesClient.getLatestPublisherCaps({
        parsed: true,
      }),
      pythnetClient.getPublisherNumberOfSymbols(),
    ]);

  return extractPublisherData(poolData).map((publisher) => {
    const publisherPubkeyString = publisher.pubkey.toBase58();
    const publisherRanking = publisherRankings.find(
      (ranking) => ranking.publisher === publisherPubkeyString,
    );
    const numberOfSymbols = publisherNumberOfSymbols[publisherPubkeyString];
    const apyHistory = publisher.apyHistory.map(({ epoch, apy, selfApy }) => ({
      date: epochToDate(epoch + 1n),
      apy,
      selfApy,
    }));

    return {
      apyHistory,
      identity: lookup(publisher.pubkey.toBase58()),
      numFeeds: numberOfSymbols ?? 0,
      poolCapacity: getPublisherCap(publisherCaps, publisher.pubkey),
      poolUtilization: publisher.totalDelegation,
      poolUtilizationDelta: publisher.totalDelegationDelta,
      publicKey: publisher.pubkey,
      qualityRanking: publisherRanking?.rank ?? 0,
      selfStake: publisher.selfDelegation,
      selfStakeDelta: publisher.selfDelegationDelta,
      stakeAccount: publisher.stakeAccount ?? undefined,
      delegationFee: publisher.delegationFee,
    };
  });
};

const getPublisherRankings = async () => {
  const response = await fetch("/api/publishers-ranking");
  const responseAsJson: unknown = await response.json();
  return publishersRankingSchema.parseAsync(responseAsJson);
};

const getPublisherCap = (publisherCaps: PublisherCaps, publisher: PublicKey) =>
  BigInt(
    publisherCaps.parsed?.[0]?.publisher_stake_caps.find(
      ({ publisher: p }) => p === publisher.toBase58(),
    )?.cap ?? 0,
  );

export const createStakeAccountAndDeposit = async (
  client: PythStakingClient,
  amount: bigint,
): Promise<PublicKey> => {
  return client.createStakeAccountAndDeposit(amount);
};

export const deposit = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  amount: bigint,
): Promise<void> => {
  await client.depositTokensToStakeAccountCustody(stakeAccount, amount);
};

export const withdraw = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  amount: bigint,
): Promise<void> => {
  await client.withdrawTokensFromStakeAccountCustody(stakeAccount, amount);
};

export const claim = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
): Promise<void> => {
  await client.advanceDelegationRecord(stakeAccount);
};

export const stakeGovernance = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  amount: bigint,
): Promise<void> => {
  await client.stakeToGovernance(stakeAccount, amount);
};

export const cancelWarmupGovernance = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  amount: bigint,
): Promise<void> => {
  await client.unstakeFromGovernance(
    stakeAccount,
    PositionState.LOCKING,
    amount,
  );
};

export const unstakeGovernance = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  amount: bigint,
): Promise<void> => {
  await client.unstakeFromGovernance(
    stakeAccount,
    PositionState.LOCKED,
    amount,
  );
};

export const delegateIntegrityStaking = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  publisherKey: PublicKey,
  amount: bigint,
): Promise<void> => {
  await client.stakeToPublisher(stakeAccount, publisherKey, amount);
};

export const cancelWarmupIntegrityStaking = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  publisherKey: PublicKey,
  amount: bigint,
): Promise<void> => {
  await client.unstakeFromPublisher(
    stakeAccount,
    publisherKey,
    PositionState.LOCKING,
    amount,
  );
};

export const unstakeIntegrityStaking = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  publisherKey: PublicKey,
  amount: bigint,
): Promise<void> => {
  await client.unstakeFromPublisher(
    stakeAccount,
    publisherKey,
    PositionState.LOCKED,
    amount,
  );
};

export const unstakeAllIntegrityStaking = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
): Promise<void> => {
  await client.unstakeFromAllPublishers(stakeAccount, [
    PositionState.LOCKED,
    PositionState.LOCKING,
  ]);
};

export const reassignPublisherAccount = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  targetAccount: PublicKey,
  publisherKey: PublicKey,
): Promise<void> => {
  return client.reassignPublisherStakeAccount(
    publisherKey,
    stakeAccount,
    targetAccount,
  );
};

export const optPublisherOut = async (
  client: PythStakingClient,
  stakeAccount: PublicKey,
  publisherKey: PublicKey,
): Promise<void> => {
  await client.removePublisherStakeAccount(publisherKey, stakeAccount);
};
