// TODO remove these disables when moving off the mock APIs
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { HermesClient, PublisherCaps } from "@pythnetwork/hermes-client";
import {
  epochToDate,
  extractPublisherData,
  getAmountByTargetAndState,
  getCurrentEpoch,
  PositionState,
  PythStakingClient,
  type StakeAccountPositions,
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
  integrityStakingPublishers: {
    name: string | undefined;
    publicKey: PublicKey;
    stakeAccount: PublicKey | undefined;
    selfStake: bigint;
    selfStakeDelta: bigint;
    poolCapacity: bigint;
    poolUtilization: bigint;
    poolUtilizationDelta: bigint;
    numFeeds: number;
    qualityRanking: number;
    apyHistory: { date: Date; apy: number }[];
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

export enum AccountHistoryItemType {
  AddTokens,
  LockedDeposit,
  Withdrawal,
  RewardsCredited,
  Claim,
  Slash,
  Unlock,
  StakeCreated,
  StakeFinishedWarmup,
  UnstakeCreated,
  UnstakeExitedCooldown,
}

const AccountHistoryAction = {
  AddTokens: () => ({ type: AccountHistoryItemType.AddTokens as const }),
  LockedDeposit: (unlockDate: Date) => ({
    type: AccountHistoryItemType.LockedDeposit as const,
    unlockDate,
  }),
  Withdrawal: () => ({ type: AccountHistoryItemType.Withdrawal as const }),
  RewardsCredited: () => ({
    type: AccountHistoryItemType.RewardsCredited as const,
  }),
  Claim: () => ({ type: AccountHistoryItemType.Claim as const }),
  Slash: (publisherName: string) => ({
    type: AccountHistoryItemType.Slash as const,
    publisherName,
  }),
  Unlock: () => ({ type: AccountHistoryItemType.Unlock as const }),
  StakeCreated: (details: StakeDetails) => ({
    type: AccountHistoryItemType.StakeCreated as const,
    details,
  }),
  StakeFinishedWarmup: (details: StakeDetails) => ({
    type: AccountHistoryItemType.StakeFinishedWarmup as const,
    details,
  }),
  UnstakeCreated: (details: StakeDetails) => ({
    type: AccountHistoryItemType.UnstakeCreated as const,
    details,
  }),
  UnstakeExitedCooldown: (details: StakeDetails) => ({
    type: AccountHistoryItemType.UnstakeExitedCooldown as const,
    details,
  }),
};

export type AccountHistoryAction = ReturnType<
  (typeof AccountHistoryAction)[keyof typeof AccountHistoryAction]
>;

export type AccountHistory = {
  timestamp: Date;
  action: AccountHistoryAction;
  amount: bigint;
  accountTotal: bigint;
  availableToWithdraw: bigint;
  availableRewards: bigint;
  locked: bigint;
}[];

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
  hermesClient: HermesClient,
  stakeAccount?: PublicKey | undefined,
): Promise<Data> =>
  stakeAccount === undefined
    ? loadDataNoStakeAccount(client, hermesClient)
    : loadDataForStakeAccount(client, hermesClient, stakeAccount);

const loadDataNoStakeAccount = async (
  client: PythStakingClient,
  hermesClient: HermesClient,
): Promise<Data> => {
  const { publishers, ...baseInfo } = await loadBaseInfo(client, hermesClient);

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
  hermesClient: HermesClient,
  stakeAccount: PublicKey,
): Promise<Data> => {
  const [
    { publishers, ...baseInfo },
    stakeAccountCustody,
    unlockSchedule,
    claimableRewards,
    stakeAccountPositions,
  ] = await Promise.all([
    loadBaseInfo(client, hermesClient),
    client.getStakeAccountCustody(stakeAccount),
    client.getUnlockSchedule(stakeAccount),
    client.getClaimableRewards(stakeAccount),
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
  hermesClient: HermesClient,
) => {
  const [publishers, walletAmount, poolConfig, currentEpoch] =
    await Promise.all([
      loadPublisherData(client, hermesClient),
      client.getOwnerPythBalance(),
      client.getPoolConfigAccount(),
      getCurrentEpoch(client.connection),
    ]);

  return { yieldRate: poolConfig.y, walletAmount, publishers, currentEpoch };
};

const loadPublisherData = async (
  client: PythStakingClient,
  hermesClient: HermesClient,
) => {
  const [poolData, publisherRankings, publisherCaps] = await Promise.all([
    client.getPoolDataAccount(),
    getPublisherRankings(),
    hermesClient.getLatestPublisherCaps({
      parsed: true,
    }),
  ]);

  return extractPublisherData(poolData).map((publisher) => {
    const publisherPubkeyString = publisher.pubkey.toBase58();
    const publisherRanking = publisherRankings.find(
      (ranking) => ranking.publisher === publisherPubkeyString,
    );
    const apyHistory = publisher.apyHistory.map(({ epoch, apy }) => ({
      date: epochToDate(epoch + 1n),
      apy,
    }));

    return {
      apyHistory,
      name: undefined, // TODO
      numFeeds: publisherRanking?.numSymbols ?? 0,
      poolCapacity: getPublisherCap(publisherCaps, publisher.pubkey),
      poolUtilization: publisher.totalDelegation,
      poolUtilizationDelta: publisher.totalDelegationDelta,
      publicKey: publisher.pubkey,
      qualityRanking: publisherRanking?.rank ?? 0,
      selfStake: publisher.selfDelegation,
      selfStakeDelta: publisher.selfDelegationDelta,
      stakeAccount: publisher.stakeAccount ?? undefined,
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

export const loadAccountHistory = async (
  _client: PythStakingClient,
  _stakeAccount: PublicKey,
): Promise<AccountHistory> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return mkMockHistory();
};

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
  await client.removePublisherStakeAccount(stakeAccount, publisherKey);
};

const MOCK_DELAY = 500;

const mkMockHistory = (): AccountHistory => [
  {
    timestamp: new Date("2024-06-10T00:00:00Z"),
    action: AccountHistoryAction.AddTokens(),
    amount: 2_000_000n,
    accountTotal: 2_000_000n,
    availableRewards: 0n,
    availableToWithdraw: 2_000_000n,
    locked: 0n,
  },
  {
    timestamp: new Date("2024-06-14T02:00:00Z"),
    action: AccountHistoryAction.RewardsCredited(),
    amount: 200n,
    accountTotal: 2_000_000n,
    availableRewards: 200n,
    availableToWithdraw: 2_000_000n,
    locked: 0n,
  },
  {
    timestamp: new Date("2024-06-16T08:00:00Z"),
    action: AccountHistoryAction.Claim(),
    amount: 200n,
    accountTotal: 2_000_200n,
    availableRewards: 0n,
    availableToWithdraw: 2_000_200n,
    locked: 0n,
  },
  {
    timestamp: new Date("2024-06-16T08:00:00Z"),
    action: AccountHistoryAction.Slash("Cboe"),
    amount: 1000n,
    accountTotal: 1_999_200n,
    availableRewards: 0n,
    availableToWithdraw: 1_999_200n,
    locked: 0n,
  },
];
