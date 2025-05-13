import { Wallet } from "@coral-xyz/anchor";
import {
  PublicKey,
  Signer,
  SystemProgram,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";

export const TIP_ACCOUNTS = [
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
];

export function getRandomTipAccount(): PublicKey {
  const randomInt = Math.floor(Math.random() * TIP_ACCOUNTS.length);
  return new PublicKey(TIP_ACCOUNTS[randomInt]);
}

export function buildJitoTipInstruction(
  payer: PublicKey,
  lamports: number,
): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: getRandomTipAccount(),
    lamports,
  });
}

export async function sendTransactionsJito(
  transactions: {
    tx: VersionedTransaction;
    signers?: Signer[] | undefined;
  }[],
  searcherClients: SearcherClient | SearcherClient[],
  wallet: Wallet,
  options: {
    maxRetryTimeMs?: number;
  } = {},
): Promise<string> {
  const clients = Array.isArray(searcherClients)
    ? searcherClients
    : [searcherClients];

  if (clients.length === 0) {
    throw new Error("No searcher clients provided");
  }

  const maxRetryTimeMs = options.maxRetryTimeMs || 60000; // Default to 60 seconds
  const startTime = Date.now();

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

  const firstTransactionSignature = bs58.encode(
    signedTransactions[0].signatures[0],
  );

  const bundle = new Bundle(signedTransactions, 2);

  let lastError: Error | null = null;
  let clientIndex = 0;

  while (Date.now() - startTime < maxRetryTimeMs) {
    const currentClient = clients[clientIndex];
    try {
      await currentClient.sendBundle(bundle);
      return firstTransactionSignature;
    } catch (err: any) {
      lastError = err;
      clientIndex = (clientIndex + 1) % clients.length;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw (
    lastError ||
    new Error("Failed to send transactions via JITO after maximum retry time")
  );
}
