import type { BN, IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import type { IntegrityPool } from "./types/integrity-pool.js";
import type { Staking } from "./types/staking.js";

// This type converts all From types to To types in a given object.
export type Convert<T, From, To> = T extends From
  ? To
  : T extends (infer U)[]
    ? Convert<U, From, To>[]
    : T extends Record<string, unknown>
      ? {
          [K in keyof T]: Convert<T[K], From, To>;
        }
      : T;

export type ConvertBNToBigInt<T> = Convert<T, BN, bigint>;
export type ConvertBigIntToBN<T> = Convert<T, bigint, BN>;

export type PositionAnchor = IdlTypes<Staking>["position"];
export type Position = ConvertBNToBigInt<PositionAnchor>;

export type GlobalConfigAnchor = IdlAccounts<Staking>["globalConfig"];
export type GlobalConfig = ConvertBNToBigInt<GlobalConfigAnchor>;

export type PoolConfigAnchor = IdlAccounts<IntegrityPool>["poolConfig"];
export type PoolConfig = ConvertBNToBigInt<PoolConfigAnchor>;

export type PoolDataAccountAnchor = IdlAccounts<IntegrityPool>["poolData"];
export type PoolDataAccount = ConvertBNToBigInt<PoolDataAccountAnchor>;

export type TargetWithParameters = IdlTypes<Staking>["targetWithParameters"];

export type VestingScheduleAnchor = IdlTypes<Staking>["vestingSchedule"];
export type VestingSchedule = ConvertBNToBigInt<VestingScheduleAnchor>;

export type TargetAccountAnchor = IdlAccounts<Staking>["targetMetadata"];
export type TargetAccount = ConvertBNToBigInt<TargetAccountAnchor>;

export type VoterWeightAction = IdlTypes<Staking>["voterWeightAction"];

export type UnlockSchedule = {
  type: "fullyUnlocked" | "periodicUnlockingAfterListing" | "periodicUnlocking";
  schedule: {
    date: Date;
    amount: bigint;
  }[];
};

export type StakeAccountPositions = {
  address: PublicKey;
  data: {
    owner: PublicKey;
    positions: Position[];
  };
};

export type PublisherData = {
  pubkey: PublicKey;
  stakeAccount: PublicKey | null;
  totalDelegation: bigint;
  totalDelegationDelta: bigint;
  selfDelegation: bigint;
  selfDelegationDelta: bigint;
  delegationFee: bigint;
  apyHistory: { epoch: bigint; apy: number; selfApy: number }[];
}[];

export enum PositionState {
  UNLOCKED,
  LOCKING,
  LOCKED,
  PREUNLOCKING,
  UNLOCKING,
}
