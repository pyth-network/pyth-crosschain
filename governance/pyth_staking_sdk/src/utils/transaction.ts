import {
  sendTransactions,
  TransactionBuilder,
} from "@pythnetwork/solana-utils";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, TransactionInstruction } from "@solana/web3.js";

export const sendTransaction = async (
  instructions: TransactionInstruction[],
  connection: Connection,
  wallet: AnchorWallet,
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

  return sendTransactions(transactions, connection, wallet);
};
