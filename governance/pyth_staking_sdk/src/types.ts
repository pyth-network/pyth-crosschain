import type { Staking } from "../types/staking";
import type { BN, IdlAccounts, IdlTypes } from "@coral-xyz/anchor";

export type Convert<T, From, To> = T extends Function
  ? T
  : {
      [K in keyof T]: T[K] extends From
        ? To
        : T[K] extends From | null
        ? To | null
        : T[K];
    };

export type ConvertBNToBigInt<T> = Convert<T, BN, bigint>;
export type ConvertBigIntToBN<T> = Convert<T, bigint, BN>;

export type PositionAnchor = IdlTypes<Staking>["position"];
export type Position = ConvertBNToBigInt<PositionAnchor>;

export type GlobalConfigAnchor = IdlAccounts<Staking>["globalConfig"];
export type GlobalConfig = ConvertBNToBigInt<GlobalConfigAnchor>;

export enum PositionState {
  UNLOCKED = 0,
  LOCKING = 1,
  LOCKED = 2,
  PREUNLOCKING = 3,
  UNLOCKING = 4,
}
