import type { TransactionInstruction } from "@solana/web3.js";
import {
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";

export const PROGRAM_AUTHORITY_ESCROW = new PublicKey(
  "escMHe7kSqPcDHx4HU44rAHhgdTLBZkUrU39aN8kMcL",
);

export const BPF_UPGRADABLE_LOADER = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

// Header lengths of `UpgradeableLoaderState::Buffer` and `::ProgramData`; the ELF follows.
export const BUFFER_METADATA_SIZE = 4 + 1 + 32;
export const PROGRAMDATA_METADATA_SIZE = 4 + 8 + 1 + 32;

export function getProgramDataAddress(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_UPGRADABLE_LOADER,
  )[0];
}

// The upgraded program only becomes executable in the slot after this lands, so anything
// depending on the new code has to go in a later transaction.
export function getUpgradeInstruction(
  programId: PublicKey,
  buffer: PublicKey,
  upgradeAuthority: PublicKey,
  spill: PublicKey,
): TransactionInstruction {
  return {
    data: Buffer.from(Uint32Array.of(3).buffer), // UpgradeableLoaderInstruction::Upgrade
    keys: [
      {
        isSigner: false,
        isWritable: true,
        pubkey: getProgramDataAddress(programId),
      },
      { isSigner: false, isWritable: true, pubkey: programId },
      { isSigner: false, isWritable: true, pubkey: buffer },
      { isSigner: false, isWritable: true, pubkey: spill },
      { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY },
      { isSigner: false, isWritable: false, pubkey: SYSVAR_CLOCK_PUBKEY },
      { isSigner: true, isWritable: false, pubkey: upgradeAuthority },
    ],
    programId: BPF_UPGRADABLE_LOADER,
  };
}
