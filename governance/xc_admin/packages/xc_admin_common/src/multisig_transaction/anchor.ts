import { Idl } from "@coral-xyz/anchor";
import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";

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
      named[ix.accounts[idx].name] = account;
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
  let idlAddress = await getIdlAddress(programId);
  return {
    programId,
    data: IDL_SET_BUFFER_DISCRIMINATOR,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: idlAddress, isSigner: false, isWritable: true },
      {
        pubkey: idlAuthority,
        isSigner: true,
        isWritable: true,
      },
    ],
  };
}
