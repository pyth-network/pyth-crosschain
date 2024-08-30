import { PublicKey } from "@solana/web3.js";
import { STAKING_PROGRAM_ADDRESS } from "./constants";

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
