import type { IntegrityPool } from "../types/integrity_pool";
import type { Staking } from "../types/staking";
import type { BN, IdlAccounts, IdlTypes } from "@coral-xyz/anchor";

// This type converts all From types to To types in a given object.
export type Convert<T, From, To> = T extends From
  ? To
  : T extends Array<infer U>
  ? Array<Convert<U, From, To>>
  : T extends Record<string, unknown>
  ? {
      [K in keyof T]: T[K] extends From
        ? To
        : T[K] extends From | null
        ? To | null
        : T[K] extends Record<string, unknown> | Array<unknown>
        ? Convert<T[K], From, To>
        : T[K];
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

export type UnlockSchedule = {
  date: Date;
  amount: bigint;
}[];

export enum PositionState {
  UNLOCKED = 0,
  LOCKING = 1,
  LOCKED = 2,
  PREUNLOCKING = 3,
  UNLOCKING = 4,
}
