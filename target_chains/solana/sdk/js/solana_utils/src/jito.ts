import { dummyLogger, Logger } from "ts-log";
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
    maxRetryTimeMs?: number; // Max time to retry sending transactions
    delayBetweenCyclesMs?: number; // Delay between cycles of sending transactions to all searcher clients
  } = {},
  logger: Logger = dummyLogger, // Optional logger to track progress of retries
): Promise<string> {
  const clients = Array.isArray(searcherClients)
    ? searcherClients
    : [searcherClients];

  if (clients.length === 0) {
    throw new Error("No searcher clients provided");
  }

  const maxRetryTimeMs = options.maxRetryTimeMs || 60000; // Default to 60 seconds
  const delayBetweenCyclesMs = options.delayBetweenCyclesMs || 1000; // Default to 1 second

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
  let totalAttempts = 0;

  while (Date.now() - startTime < maxRetryTimeMs) {
    // Try all clients in this cycle
    for (let i = 0; i < clients.length; i++) {
      const currentClient = clients[i];
      totalAttempts++;

      try {
        await currentClient.sendBundle(bundle);
        logger.info(
          { clientIndex: i, totalAttempts },
          `Successfully sent bundle to Jito client after ${totalAttempts} attempts`,
        );
        return firstTransactionSignature;
      } catch (err: any) {
        lastError = err;
        logger.error(
          { clientIndex: i, totalAttempts, err: err.message },
          `Attempt ${totalAttempts}: Error sending bundle to Jito client ${i}`,
        );
      }

      // Check if we've run out of time
      if (Date.now() - startTime >= maxRetryTimeMs) {
        break;
      }
    }

    // If we've tried all clients and still have time, wait before next cycle
    const timeRemaining = maxRetryTimeMs - (Date.now() - startTime);
    if (timeRemaining > delayBetweenCyclesMs) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenCyclesMs));
    }
  }

  const totalTimeMs = Date.now() - startTime;
  const errorMsg = `Failed to send transactions via JITO after ${totalAttempts} attempts over ${totalTimeMs}ms (max: ${maxRetryTimeMs}ms)`;

  logger.error(
    {
      totalAttempts,
      totalTimeMs,
      maxRetryTimeMs,
      lastError: lastError?.message,
    },
    errorMsg,
  );

  throw lastError || new Error(errorMsg);
}
