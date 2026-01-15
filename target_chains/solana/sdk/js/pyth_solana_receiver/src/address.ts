// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer as IsomorphicBuffer } from "buffer";

import { PublicKey } from "@solana/web3.js";

/**
 * The default Pyth Solana Receiver program ID.
 * The program is deployed at this address on all SVM networks.
 */
export const DEFAULT_RECEIVER_PROGRAM_ID = new PublicKey(
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
);
/**
 * The default Wormhole program ID.
 * The program is deployed at this address on all SVM networks.
 */
export const DEFAULT_WORMHOLE_PROGRAM_ID = new PublicKey(
  "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ",
);

export const DEFAULT_PUSH_ORACLE_PROGRAM_ID = new PublicKey(
  "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT",
);

/**
 * Returns the address of a guardian set account from the Wormhole program.
 */
export const getGuardianSetPda = (
  guardianSetIndex: number,
  wormholeProgramId: PublicKey,
) => {
  const guardianSetIndexBuf = IsomorphicBuffer.alloc(4);
  guardianSetIndexBuf.writeUInt32BE(guardianSetIndex, 0);
  return PublicKey.findProgramAddressSync(
    [IsomorphicBuffer.from("GuardianSet"), guardianSetIndexBuf],
    wormholeProgramId,
  )[0];
};

/**
 * The Pyth Solana Receiver has one treasury account for each u8 `treasuryId`.
 * This is meant to avoid write-locks on the treasury account by load-balancing the writes across multiple accounts.
 */
export function getRandomTreasuryId() {
  return Math.floor(Math.random() * 256);
}

/**
 * Returns the address of a treasury account from the Pyth Solana Receiver program.
 */
export const getTreasuryPda = (
  treasuryId: number,
  receiverProgramId: PublicKey,
) => {
  return PublicKey.findProgramAddressSync(
    [IsomorphicBuffer.from("treasury"), IsomorphicBuffer.from([treasuryId])],
    receiverProgramId,
  )[0];
};

/**
 * Returns the address of the config account from the Pyth Solana Receiver program.
 */
export const getConfigPda = (receiverProgramId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [IsomorphicBuffer.from("config")],
    receiverProgramId,
  )[0];
};
