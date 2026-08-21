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

/**
 * Byte length of the bincode-serialized `UpgradeableLoaderState::Buffer` header
 * (a 4-byte enum discriminant followed by an `Option<Pubkey>` authority). The
 * program's ELF starts right after it.
 */
export const BUFFER_METADATA_SIZE = 37;

/**
 * Byte length of the bincode-serialized `UpgradeableLoaderState::ProgramData`
 * header (4-byte enum discriminant, `u64` deployment slot, `Option<Pubkey>`
 * upgrade authority). The deployed ELF starts right after it.
 */
export const PROGRAMDATA_METADATA_SIZE = 45;

/**
 * Address of the program data account holding `programId`'s ELF and its upgrade
 * authority.
 */
export function getProgramDataAddress(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_UPGRADABLE_LOADER,
  )[0];
}

/**
 * Build the loader's `Upgrade` instruction, which copies the ELF staged in
 * `buffer` over `programId` and refunds the buffer's rent to `spill`.
 *
 * The upgraded program only becomes executable in the slot after the one this
 * lands in, so any instruction that depends on the new code has to go in a later
 * transaction.
 */
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
