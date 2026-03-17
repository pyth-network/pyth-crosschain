import type { Idl } from "@coral-xyz/anchor";
import type { AccountMeta, TransactionInstruction } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

type NamedAccounts = Record<string, AccountMeta>;
type RemainingAccounts = AccountMeta[];
export type AnchorAccounts = {
  named: NamedAccounts;
  remaining: RemainingAccounts;
};

export function resolveAccountNames(
  idl: Idl,
  name: string,
  instruction: TransactionInstruction,
): { named: NamedAccounts; remaining: RemainingAccounts } {
  const ix = idl.instructions.find((ix) => ix.name == name);
  if (!ix) {
    return { named: {}, remaining: instruction.keys };
  }
  const named: NamedAccounts = {};
  const remaining: RemainingAccounts = [];
  instruction.keys.map((account, idx) => {
    if (idx < ix.accounts.length) {
      named[ix.accounts[idx]?.name] = account;
    } else {
      remaining.push(account);
    }
  });
  return { named, remaining };
}

export const IDL_SET_BUFFER_DISCRIMINATOR = Buffer.from(
  "40f4bc78a7e9690a03",
  "hex",
);

async function getIdlAddress(programId: PublicKey): Promise<PublicKey> {
  const programSigner = PublicKey.findProgramAddressSync([], programId)[0];
  return PublicKey.createWithSeed(programSigner, "anchor:idl", programId);
}

export async function idlSetBuffer(
  programId: PublicKey,
  buffer: PublicKey,
  idlAuthority: PublicKey,
): Promise<TransactionInstruction> {
  const idlAddress = await getIdlAddress(programId);
  return {
    data: IDL_SET_BUFFER_DISCRIMINATOR,
    keys: [
      { isSigner: false, isWritable: true, pubkey: buffer },
      { isSigner: false, isWritable: true, pubkey: idlAddress },
      {
        isSigner: true,
        isWritable: true,
        pubkey: idlAuthority,
      },
    ],
    programId,
  };
}
