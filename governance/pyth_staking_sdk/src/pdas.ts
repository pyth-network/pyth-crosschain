import { PublicKey } from "@solana/web3.js";
import {
  INTEGRITY_POOL_PROGRAM_ADDRESS,
  STAKING_PROGRAM_ADDRESS,
} from "./constants";

export const getConfigAddress = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ADDRESS
  );
};

export const getStakeAccountCustodyAddress = (
  stakeAccountPositionsAddress: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("custody"), stakeAccountPositionsAddress.toBuffer()],
    STAKING_PROGRAM_ADDRESS
  )[0];
};

export const getStakeAccountMetadataAddress = (
  stakeAccountPositionsAddress: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake_metadata"), stakeAccountPositionsAddress.toBuffer()],
    STAKING_PROGRAM_ADDRESS
  )[0];
};

export const getPoolConfigAddress = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_config")],
    INTEGRITY_POOL_PROGRAM_ADDRESS
  )[0];
};
