import { Cluster, PublicKey } from "@solana/web3.js";
import Squads, {
  DEFAULT_MULTISIG_PROGRAM_ID,
  getIxPDA,
  getTxPDA,
} from "@sqds/mesh";
import { InstructionAccount, TransactionAccount } from "@sqds/mesh/lib/types";
import BN from "bn.js";
import lodash from "lodash";

/**
 * Address of the upgrade multisig
 */
export const UPGRADE_MULTISIG: Record<Cluster | "localnet", PublicKey> = {
  "mainnet-beta": new PublicKey("FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"),
  testnet: new PublicKey("FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"),
  devnet: new PublicKey("6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3"),
  localnet: new PublicKey("FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"),
};

/**
 * Address of the price feed multisig
 */
export const PRICE_FEED_MULTISIG: Record<Cluster | "localnet", PublicKey> = {
  "mainnet-beta": new PublicKey("92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8"),
  testnet: new PublicKey("92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8"),
  devnet: new PublicKey("92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8"),
  localnet: new PublicKey("92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8"),
};

/**
 * Address of the ops key (same on all networks)
 */
export const PRICE_FEED_OPS_KEY = new PublicKey(
  "ACzP6RC98vcBk9oTeAwcH1o5HJvtBzU59b5nqdwc7Cxy"
);

export const UPGRADE_OPS_KEY = new PublicKey(
  "opsLibxVY7Vz5eYMmSfX8cLFCFVYTtH6fr6MiifMpA7"
);

export function getOpsKey(vault: PublicKey): PublicKey {
  if (
    Object.values(PRICE_FEED_MULTISIG).some((pubkey) => {
      return pubkey.equals(vault);
    })
  )
    return PRICE_FEED_OPS_KEY;
  else if (
    Object.values(UPGRADE_MULTISIG).some((pubkey) => {
      return pubkey.equals(vault);
    })
  )
    return UPGRADE_OPS_KEY;
  else throw new Error("Unrecognized multisig vault");
}

/**
 * Find all proposals for vault `vault` using Squads client `squad`
 * @param squad Squads client
 * @param vault vault public key. It needs to exist in the instance of squads that `squad` is targeting
 * @param offset (optional) ignore all proposals with `proposal_index < offset`
 * @param state filter by status
 * @returns All the proposal accounts as `TransactionAccount`
 */
export async function getProposals(
  squad: Squads,
  vault: PublicKey,
  offset: number = 1,
  state: "active" | "executeReady" | "executed" | "all" = "all"
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
    .filter((x) =>
      state === "all" ? true : lodash.isEqual(x.status, { [state]: {} })
    );
}

/**
 * Get all the instructions for many proposals in one RPC call
 * @param squad Squads client
 * @param txAccounts transaction (proposal) accounts
 * @returns `InstructionAccount[][]`, `result[0]` is the array of all the instructions from proposal 0
 */
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

  let allTxIxsAccounts = await squad.getInstructions(allIxsKeys);
  let ixAccountsByTx: InstructionAccount[][] = Array.from(
    Array(txAccounts.length),
    () => []
  );

  for (let i = 0; i < allTxIxsAccounts.length; i++) {
    const toAdd = allTxIxsAccounts[i];
    if (toAdd) {
      ixAccountsByTx[ownerTransaction[i]].push(toAdd);
    }
  }
  return ixAccountsByTx;
}

/**
 * Get all the instructions for one proposal
 * @param squad Squads client
 * @param txAccount transaction (proposal) account
 * @returns All the instructions of the proposal
 */
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
