import { Staking } from "../../types/staking";
import { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";

export type Position = IdlTypes<Staking>["position"];
export type GlobalConfig = IdlAccounts<Staking>["globalConfig"];
