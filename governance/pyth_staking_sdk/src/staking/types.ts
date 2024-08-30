import type { Staking } from "../../types/staking";
import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";

export type Position = IdlTypes<Staking>["position"];
export type GlobalConfig = IdlAccounts<Staking>["globalConfig"];

export enum PositionState {
  UNLOCKED = 0,
  LOCKING = 1,
  LOCKED = 2,
  PREUNLOCKING = 3,
  UNLOCKING = 4,
}
