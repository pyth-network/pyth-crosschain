import { Idl } from "@coral-xyz/anchor";
import { AccountMeta, TransactionInstruction } from "@solana/web3.js";

type NamedAccounts = Record<string, AccountMeta>;
type RemainingAccounts = AccountMeta[];
export type AnchorAccounts = {
  named: NamedAccounts;
  remaining: RemainingAccounts;
};

export function resolveAccountNames(
  idl: Idl,
  name: string,
  instruction: TransactionInstruction
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
