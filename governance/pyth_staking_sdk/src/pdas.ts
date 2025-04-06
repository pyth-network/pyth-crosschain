import { PublicKey } from "@solana/web3.js";

import {
  INTEGRITY_POOL_PROGRAM_ADDRESS,
  STAKE_CAPS_PARAMETERS_PROGRAM_ADDRESS,
  STAKING_PROGRAM_ADDRESS,
} from "./constants.js";

export const getConfigAddress = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ADDRESS,
  );
};

export const getStakeAccountCustodyAddress = (
  stakeAccountPositionsAddress: PublicKey,
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("custody"), stakeAccountPositionsAddress.toBuffer()],
    STAKING_PROGRAM_ADDRESS,
  )[0];
};

export const getStakeAccountMetadataAddress = (
  stakeAccountPositionsAddress: PublicKey,
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake_metadata"), stakeAccountPositionsAddress.toBuffer()],
    STAKING_PROGRAM_ADDRESS,
  )[0];
};

export const getPoolConfigAddress = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_config")],
    INTEGRITY_POOL_PROGRAM_ADDRESS,
  )[0];
};

export const getDelegationRecordAddress = (
  stakeAccountPositions: PublicKey,
  publisher: PublicKey,
) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("delegation_record"),
      publisher.toBuffer(),
      stakeAccountPositions.toBuffer(),
    ],
    INTEGRITY_POOL_PROGRAM_ADDRESS,
  )[0];
};

export const getTargetAccountAddress = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("target"), Buffer.from("voting")],
    STAKING_PROGRAM_ADDRESS,
  )[0];
};

export const getVoterWeightRecordAddress = (
  stakeAccountPositions: PublicKey,
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("voter_weight"), stakeAccountPositions.toBuffer()],
    STAKING_PROGRAM_ADDRESS,
  );
};

export const getMaxVoterWeightRecordAddress = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("max_voter")],
    STAKING_PROGRAM_ADDRESS,
  );
};

export const getStakeCapsParametersAddress = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("parameters")],
    STAKE_CAPS_PARAMETERS_PROGRAM_ADDRESS,
  );
};
