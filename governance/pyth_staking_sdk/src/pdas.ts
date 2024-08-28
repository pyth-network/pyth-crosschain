import { PublicKey } from "@solana/web3.js";
import { STAKING_PROGRAM_ADDRESS } from "./constants";

export const getConfigAddress = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ADDRESS
  );
};
