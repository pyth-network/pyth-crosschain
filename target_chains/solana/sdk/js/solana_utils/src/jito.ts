import { Wallet } from "@coral-xyz/anchor";
import { Signer, VersionedTransaction } from "@solana/web3.js";
import { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";

export async function sendTransactionsJito(
  transactions: {
    tx: VersionedTransaction;
    signers?: Signer[] | undefined;
  }[],
  searcherClient: SearcherClient,
  wallet: Wallet
) {
  const signedTransactions = [];

  for (const transaction of transactions) {
    const signers = transaction.signers;
    let tx = transaction.tx;

    if (signers) {
      tx.sign(signers);
    }

    tx = await wallet.signTransaction(tx);
    signedTransactions.push(tx);
  }

  const bundle = new Bundle(signedTransactions, 2);
  await searcherClient.sendBundle(bundle);

  onBundleResult(searcherClient);
}

export const onBundleResult = (c: SearcherClient) => {
  c.onBundleResult(
    (result) => {
      console.log("received bundle result:", result);
    },
    (e) => {
      throw e;
    }
  );
};
