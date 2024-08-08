/* eslint-disable @typescript-eslint/no-unused-vars */

import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";

const MOCK_DELAY = 500;

const MOCK_DATA: Data = {
  total: 15_000_000n,
  availableRewards: 156_000n,
  locked: 3_000_000n,
  walletAmount: 200_000_000n,
  governance: {
    warmup: 2_670_000n,
    staked: 4_150_000n,
    cooldown: 1_850_000n,
    cooldown2: 4_765_000n,
  },
  integrityStakingPublishers: [
    {
      name: "Foo Bar",
      publicKey: "0xF00",
      selfStake: 5_000_000_000n,
      poolCapacity: 500_000_000n,
      poolUtilization: 200_000_000n,
      apy: 20,
      numFeeds: 42,
      qualityRanking: 1,
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
      selfStake: 400_000_000n,
      poolCapacity: 500_000_000n,
      poolUtilization: 600_000_000n,
      apy: 10,
      numFeeds: 84,
      qualityRanking: 2,
      positions: {
        staked: 1_000_000n,
      },
    },
  ],
};

type Data = {
  total: bigint;
  availableRewards: bigint;
  locked: bigint;
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
    selfStake: bigint;
    poolCapacity: bigint;
    poolUtilization: bigint;
    apy: number;
    numFeeds: number;
    qualityRanking: number;
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

export const loadData = async (
  _connection: Connection,
  _wallet: WalletContextState,
  _signal?: AbortSignal | undefined,
): Promise<Data> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return MOCK_DATA;
};

export const deposit = async (
  _connection: Connection,
  _wallet: WalletContextState,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  MOCK_DATA.total += amount;
  MOCK_DATA.walletAmount -= amount;
};

export const withdraw = async (
  _connection: Connection,
  _wallet: WalletContextState,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  MOCK_DATA.total -= amount;
  MOCK_DATA.walletAmount += amount;
};

export const claim = async (
  _connection: Connection,
  _wallet: WalletContextState,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  MOCK_DATA.total += MOCK_DATA.availableRewards;
  MOCK_DATA.availableRewards = 0n;
};

export const stakeGovernance = async (
  _connection: Connection,
  _wallet: WalletContextState,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  MOCK_DATA.governance.warmup += amount;
};

export const cancelWarmupGovernance = async (
  _connection: Connection,
  _wallet: WalletContextState,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  MOCK_DATA.governance.warmup -= amount;
};

export const unstakeGovernance = async (
  _connection: Connection,
  _wallet: WalletContextState,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  MOCK_DATA.governance.staked -= amount;
  MOCK_DATA.governance.cooldown += amount;
};

export const delegateIntegrityStaking = async (
  _connection: Connection,
  _wallet: WalletContextState,
  publisherKey: string,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const publisher = MOCK_DATA.integrityStakingPublishers.find(
    (publisher) => publisher.publicKey === publisherKey,
  );
  if (publisher) {
    publisher.positions ||= {};
    publisher.positions.warmup = (publisher.positions.warmup ?? 0n) + amount;
  } else {
    throw new Error(`Invalid publisher key: "${publisherKey}"`);
  }
};

export const cancelWarmupIntegrityStaking = async (
  _connection: Connection,
  _wallet: WalletContextState,
  publisherKey: string,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const publisher = MOCK_DATA.integrityStakingPublishers.find(
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
  _connection: Connection,
  _wallet: WalletContextState,
  publisherKey: string,
  amount: bigint,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const publisher = MOCK_DATA.integrityStakingPublishers.find(
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
