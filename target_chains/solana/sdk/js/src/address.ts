import { PublicKey } from "@solana/web3.js";

export const DEFAULT_RECEIVER_PROGRAM_ID = new PublicKey(
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"
);
export const DEFAULT_WORMHOLE_PROGRAM_ID = new PublicKey(
  "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ"
);

export const getGuardianSetPda = (guardianSetIndex: number) => {
  const guardianSetIndexBuf = Buffer.alloc(4);
  guardianSetIndexBuf.writeUInt32BE(guardianSetIndex, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("GuardianSet"), guardianSetIndexBuf],
    DEFAULT_WORMHOLE_PROGRAM_ID
  )[0];
};

export const getTreasuryPda = (treasuryId: number) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), Buffer.from([treasuryId])],
    DEFAULT_RECEIVER_PROGRAM_ID
  )[0];
};

export const getConfigPda = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    DEFAULT_RECEIVER_PROGRAM_ID
  )[0];
};
