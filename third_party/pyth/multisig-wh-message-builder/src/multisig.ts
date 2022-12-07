import { PublicKey } from "@solana/web3.js";
import Squads, {
  DEFAULT_MULTISIG_PROGRAM_ID,
  getIxPDA,
  getTxPDA,
} from "@sqds/mesh";
import { InstructionAccount, TransactionAccount } from "@sqds/mesh/lib/types";
import BN from "bn.js";
import lodash from "lodash";

export async function getActiveProposals(
  squad: Squads,
  vault: PublicKey,
  offset: number = 1
): Promise<TransactionAccount[]> {
  const msAccount = await squad.getMultisig(vault);
  let txKeys = lodash
    .range(offset, msAccount.transactionIndex + 1)
    .map((i) => getTxPDA(vault, new BN(i), DEFAULT_MULTISIG_PROGRAM_ID)[0]);
  let msTransactions = await squad.getTransactions(txKeys);
  return msTransactions
    .filter(
      (x: TransactionAccount | null): x is TransactionAccount => x != null
    )
    .filter((x) => lodash.isEqual(x.status, { active: {} }));
}

export async function getManyProposalsInstructions(
  squad: Squads,
  txAccounts: TransactionAccount[]
): Promise<InstructionAccount[][]> {
  let allIxsKeys = [];
  let ownerTransaction = [];
  for (let [index, txAccount] of txAccounts.entries()) {
    let ixKeys = lodash
      .range(1, txAccount.instructionIndex + 1)
      .map(
        (i) =>
          getIxPDA(
            txAccount.publicKey,
            new BN(i),
            DEFAULT_MULTISIG_PROGRAM_ID
          )[0]
      );
    for (let ixKey of ixKeys) {
      allIxsKeys.push(ixKey);
      ownerTransaction.push(index);
    }
  }

  let allTxIxsAcccounts = await squad.getInstructions(allIxsKeys);
  let ixAccountsByTx: InstructionAccount[][] = Array.from(
    Array(txAccounts.length),
    () => []
  );

  for (let i = 0; i < allTxIxsAcccounts.length; i++) {
    const toAdd = allTxIxsAcccounts[i];
    if (toAdd) {
      ixAccountsByTx[ownerTransaction[i]].push(toAdd);
    }
  }
  return ixAccountsByTx;
}

export async function getProposalInstructions(
  squad: Squads,
  txAccount: TransactionAccount
): Promise<InstructionAccount[]> {
  let ixKeys = lodash
    .range(1, txAccount.instructionIndex + 1)
    .map(
      (i) =>
        getIxPDA(txAccount.publicKey, new BN(i), DEFAULT_MULTISIG_PROGRAM_ID)[0]
    );
  let txIxs = await squad.getInstructions(ixKeys);
  return txIxs.filter(
    (x: InstructionAccount | null): x is InstructionAccount => x != null
  );
}
