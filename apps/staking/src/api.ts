// TODO remove these disables when moving off the mock APIs
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-non-null-assertion */

import { getAmountByTargetAndState, getCurrentEpoch, PositionState, PythStakingClient } from "@pythnetwork/staking-sdk";
import type { StakeAccountPositions } from "@pythnetwork/staking-sdk/src/staking/accounts";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, type Connection } from "@solana/web3.js";


export type Context = {
  connection: Connection;
  wallet: AnchorWallet;
  stakeAccount: StakeAccountPositions;
};

type Data = {
  total: bigint;
  availableRewards: bigint;
  lastSlash:
    | {
        amount: bigint;
        date: Date;
      }
    | undefined;
  expiringRewards: {
    amount: bigint;
    expiry: Date;
  } | undefined;
  locked: bigint;
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
  integrityStakingPublishers: {
    name: string;
    publicKey: string;
    isSelf: boolean;
    selfStake: bigint;
    poolCapacity: bigint;
    poolUtilization: bigint;
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
  Deposit,
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
  Deposit: () => ({ type: AccountHistoryItemType.Deposit as const }),
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

type AccountHistory = {
  timestamp: Date;
  action: AccountHistoryAction;
  amount: bigint;
  accountTotal: bigint;
  availableToWithdraw: bigint;
  availableRewards: bigint;
  locked: bigint;
}[];

export const getStakeAccounts = async (
  connection: Connection,
  wallet: AnchorWallet,
): Promise<StakeAccountPositions[]> => {
  const pythStakingClient = new PythStakingClient({ connection, wallet });
  return await pythStakingClient.getAllStakeAccountPositions(wallet.publicKey);
};

export const loadData = async (context: Context): Promise<Data> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  // While using mocks we need to clone the MOCK_DATA object every time
  // `loadData` is called so that swr treats the response as changed and
  // triggers a rerender.

  const pythStakingClient = new PythStakingClient({ connection: context.connection, wallet: context.wallet });
  const stakeAccountPositions = context.stakeAccount;

  const stakeAccountCustody = await pythStakingClient.getStakeAccountCustody(stakeAccountPositions.address);
  const publishers = await pythStakingClient.getPublishers();
  const ownerATAAccount = await pythStakingClient.getOwnerPythATAAccount();
  const currentEpoch = await getCurrentEpoch(context.connection);

  const unlockSchedule = await pythStakingClient.getUnlockSchedule({
    stakeAccountPositions: stakeAccountPositions.address
  });

  return { 
    lastSlash: undefined,
    availableRewards: 0n,
    expiringRewards: undefined,
    total: stakeAccountCustody.amount,
    governance: {
      warmup: getAmountByTargetAndState({stakeAccountPositions, targetWithParameters: {voting: {}}, positionState: PositionState.LOCKING, epoch: currentEpoch}),
      staked: getAmountByTargetAndState({stakeAccountPositions, targetWithParameters: {voting: {}}, positionState: PositionState.LOCKED, epoch: currentEpoch}),
      cooldown: getAmountByTargetAndState({stakeAccountPositions, targetWithParameters: {voting: {}}, positionState: PositionState.PREUNLOCKING, epoch: currentEpoch}),
      cooldown2: getAmountByTargetAndState({stakeAccountPositions, targetWithParameters: {voting: {}}, positionState: PositionState.UNLOCKED, epoch: currentEpoch}),
    },
    unlockSchedule,
    locked: unlockSchedule.reduce((sum, { amount }) => sum + amount, 0n),
    walletAmount: ownerATAAccount.amount,
    integrityStakingPublishers: publishers.map(publisher => ({
      apyHistory: [],
      isSelf: false,
      name: publisher.toString(),
      numFeeds: 0,
      poolCapacity: 100n,
      poolUtilization: 0n,
      publicKey: publisher.toString(),
      qualityRanking: 0,
      selfStake: 0n,
      positions: {
        warmup: getAmountByTargetAndState({stakeAccountPositions, targetWithParameters: {integrityPool: {publisher}}, positionState: PositionState.LOCKING, epoch: currentEpoch}),
        staked: getAmountByTargetAndState({stakeAccountPositions, targetWithParameters: {integrityPool: {publisher}}, positionState: PositionState.LOCKED, epoch: currentEpoch}),
        cooldown: getAmountByTargetAndState({stakeAccountPositions, targetWithParameters: {integrityPool: {publisher}}, positionState: PositionState.PREUNLOCKING, epoch: currentEpoch}),
        cooldown2: getAmountByTargetAndState({stakeAccountPositions, targetWithParameters: {integrityPool: {publisher}}, positionState: PositionState.UNLOCKED, epoch: currentEpoch}),
      }
    }))
   };
};

export const loadAccountHistory = async (
  _context: Context,
): Promise<AccountHistory> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return MOCK_HISTORY['0x000000']!;
};

export const deposit = async (
  context: Context,
  amount: bigint,
): Promise<void> => {
  const pythStakingClient = new PythStakingClient({ connection: context.connection, wallet: context.wallet });
  await pythStakingClient.depositTokensToStakeAccountCustody(context.stakeAccount.address, amount);
};

export const withdraw = async (
  context: Context,
  amount: bigint,
): Promise<void> => {
  const pythStakingClient = new PythStakingClient({ connection: context.connection, wallet: context.wallet });
  await pythStakingClient.withdrawTokensFromStakeAccountCustody(context.stakeAccount.address, amount);
};

export const claim = async (_context: Context): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));

};

export const stakeGovernance = async (
  context: Context,
  amount: bigint,
): Promise<void> => {
  const pythStakingClient = new PythStakingClient({ connection: context.connection, wallet: context.wallet });
  const p = new PublicKey(context.stakeAccount.address);

  await pythStakingClient.stakeToGovernance(p, amount);
};

export const cancelWarmupGovernance = async (
  _context: Context,
  _amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
};

export const unstakeGovernance = async (
  _context: Context,
  _amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));


};

export const delegateIntegrityStaking = async (
  context: Context,
  publisherKey: string,
  amount: bigint,
): Promise<void> => {

  const pythStakingClient = new PythStakingClient({ connection: context.connection, wallet: context.wallet });
  const p = new PublicKey(context.stakeAccount.address);

  await pythStakingClient.stakeToPublisher({
    stakeAccountPositions: p,
    publisher: new PublicKey(publisherKey),
    amount
  });
};

export const cancelWarmupIntegrityStaking = async (
  context: Context,
  publisherKey: string,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const publisher = MOCK_DATA[
    context.stakeAccount.address.toString()
  ]!.integrityStakingPublishers.find(
    (publisher) => publisher.publicKey === publisherKey,
  );
  if (publisher) {
    if (publisher.positions?.warmup) {
      publisher.positions.warmup -= amount;
    }
  } else {
    throw new Error(`Invalid publisher key: "${publisherKey}"`);
  }
};

export const unstakeIntegrityStaking = async (
  context: Context,
  publisherKey: string,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const publisher = MOCK_DATA[
    context.stakeAccount.address.toString()
  ]!.integrityStakingPublishers.find(
    (publisher) => publisher.publicKey === publisherKey,
  );
  if (publisher) {
    if (publisher.positions?.staked) {
      publisher.positions.staked -= amount;
      publisher.positions.cooldown =
        (publisher.positions.cooldown ?? 0n) + amount;
    }
  } else {
    throw new Error(`Invalid publisher key: "${publisherKey}"`);
  }
};

export const calculateApy = (
  poolCapacity: bigint,
  poolUtilization: bigint,
  isSelf: boolean,
) => {
  const maxApy = isSelf ? 25 : 20;
  const minApy = isSelf ? 10 : 5;
  return Math.min(
    Math.max(
      maxApy - Number((poolUtilization - poolCapacity) / 100_000_000n),
      minApy,
    ),
    maxApy,
  );
};

export const getUpcomingEpoch = (): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((5 + 7 - d.getUTCDay()) % 7 || 7));
  d.setUTCHours(0);
  d.setUTCMinutes(0);
  d.setUTCSeconds(0);
  d.setUTCMilliseconds(0);
  return d;
};

export const getNextFullEpoch = (): Date => {
  const d = getUpcomingEpoch();
  d.setUTCDate(d.getUTCDate() + 7);
  return d;
};

const MOCK_DELAY = 500;

const mkMockData = (isDouro: boolean): Data => ({
  total: 15_000_000n,
  availableRewards: 156_000n,
  lastSlash: isDouro
    ? undefined
    : {
        amount: 2147n,
        date: new Date("2024-05-04T00:00:00Z"),
      },
  expiringRewards: {
    amount: 56_000n,
    expiry: new Date("2025-08-01T00:00:00Z"),
  },
  locked: isDouro ? 3_000_000n : 0n,
  unlockSchedule: isDouro
    ? [
        {
          amount: 1_000_000n,
          date: new Date("2025-08-01T00:00:00Z"),
        },
        {
          amount: 2_000_000n,
          date: new Date("2025-09-01T00:00:00Z"),
        },
      ]
    : [],
  walletAmount: 5_000_000_000_000n,
  governance: {
    warmup: 2_670_000n,
    staked: 4_150_000n,
    cooldown: 1_850_000n,
    cooldown2: 4_765_000n,
  },
  integrityStakingPublishers: [
    {
      name: "Douro Labs",
      publicKey: "0xF00",
      isSelf: isDouro,
      selfStake: 5_000_000_000n,
      poolCapacity: 500_000_000n,
      poolUtilization: 200_000_000n,
      numFeeds: 42,
      qualityRanking: 1,
      apyHistory: [
        { date: new Date("2024-07-22"), apy: 5 },
        { date: new Date("2024-07-23"), apy: 10 },
        { date: new Date("2024-07-24"), apy: 25 },
        { date: new Date("2024-07-25"), apy: 20 },
      ],
      positions: {
        warmup: 5_000_000n,
        staked: 4_000_000n,
        cooldown: 1_000_000n,
        cooldown2: 460_000n,
      },
    },
    {
      name: "Jump Trading",
      publicKey: "0xBA4",
      isSelf: false,
      selfStake: 400_000_000n,
      poolCapacity: 500_000_000n,
      poolUtilization: 750_000_000n,
      numFeeds: 84,
      qualityRanking: 2,
      apyHistory: [
        { date: new Date("2024-07-24"), apy: 5 },
        { date: new Date("2024-07-25"), apy: 10 },
      ],
      positions: {
        staked: 1_000_000n,
      },
    },
    {
      name: "Cboe",
      publicKey: "0xAA",
      isSelf: false,
      selfStake: 200_000_000n,
      poolCapacity: 600_000_000n,
      poolUtilization: 450_000_000n,
      numFeeds: 17,
      qualityRanking: 5,
      apyHistory: [
        { date: new Date("2024-07-24"), apy: 5 },
        { date: new Date("2024-07-25"), apy: 10 },
      ],
    },
    {
      name: "Raydium",
      publicKey: "0x111",
      isSelf: false,
      selfStake: 400_000_000n,
      poolCapacity: 500_000_000n,
      poolUtilization: 750_000_000n,
      numFeeds: 84,
      qualityRanking: 3,
      apyHistory: [
        { date: new Date("2024-07-24"), apy: 5 },
        { date: new Date("2024-07-25"), apy: 10 },
      ],
    },
  ],
});

const MOCK_DATA: Record<
  string,
  Data
> = {
  "0x000000": mkMockData(true),
  "0x111111": mkMockData(false),
};

const mkMockHistory = (): AccountHistory => [
  {
    timestamp: new Date("2024-06-10T00:00:00Z"),
    action: AccountHistoryAction.Deposit(),
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

const MOCK_HISTORY: Record<
  string,
  AccountHistory
> = {
  "0x000000": mkMockHistory(),
  "0x111111": mkMockHistory(),
};
