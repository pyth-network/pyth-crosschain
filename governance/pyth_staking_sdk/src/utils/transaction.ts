/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TransactionBuilder } from "@pythnetwork/solana-utils";
import { Connection, TransactionInstruction } from "@solana/web3.js";

import type { PythStakingWallet } from "./wallet.js";

export const sendTransaction = async (
  instructions: TransactionInstruction[],
  connection: Connection,
  wallet: PythStakingWallet,
) => {
  const transactions = await TransactionBuilder.batchIntoVersionedTransactions(
    wallet.publicKey,
    connection,
    instructions.map((instruction) => ({
      instruction,
      signers: [],
    })),
    {},
  );

  for (const transaction of transactions) {
    await wallet.sendTransaction(transaction.tx, connection);
  }
};
