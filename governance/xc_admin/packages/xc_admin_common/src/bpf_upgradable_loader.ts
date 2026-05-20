import { PublicKey } from "@solana/web3.js";

export const PROGRAM_AUTHORITY_ESCROW = new PublicKey(
  "escMHe7kSqPcDHx4HU44rAHhgdTLBZkUrU39aN8kMcL",
);

export const BPF_UPGRADABLE_LOADER = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

/**
 * Decoded ProgramData account from BPFLoaderUpgradeable.
 * Layout: 4-byte type (u32=3) | 8-byte slot (u64 LE) | 1-byte Option tag | 32-byte pubkey
 */
export interface ProgramDataAccountInfo {
  slot: number;
  upgradeAuthority: PublicKey | null;
}

/**
 * Decode the programdata_address from a BPF upgradeable Program account.
 * Layout: 4-byte type (u32=2) | 32-byte programdata address
 */
export function decodeProgramAccount(data: Buffer): PublicKey {
  const accountType = data.readUInt32LE(0);
  if (accountType !== 2) {
    throw new Error(
      `Expected Program account type (2), got ${accountType}`,
    );
  }
  return new PublicKey(data.subarray(4, 36));
}

/**
 * Decode a ProgramData account to extract upgrade authority and deploy slot.
 * Layout: 4-byte type (u32=3) | 8-byte slot (u64 LE) | 1-byte Option<Pubkey> tag | 32-byte pubkey
 */
export function decodeProgramDataAccount(
  data: Buffer,
): ProgramDataAccountInfo {
  const accountType = data.readUInt32LE(0);
  if (accountType !== 3) {
    throw new Error(
      `Expected ProgramData account type (3), got ${accountType}`,
    );
  }
  // slot is a u64 LE at offset 4; use Number (safe for realistic slot values)
  const slot = Number(data.readBigUInt64LE(4));
  const optionTag = data[12];
  const upgradeAuthority =
    optionTag === 1 ? new PublicKey(data.subarray(13, 45)) : null;
  return { slot, upgradeAuthority };
}
