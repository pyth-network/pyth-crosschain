import crypto from "crypto";
// @ts-expect-error
globalThis.crypto = crypto;

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { pythOracleProgram } from "@pythnetwork/client";
import {
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  Connection,
  Keypair,
  PACKET_DATA_SIZE,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  batchIntoExecutorPayload,
  getSizeOfExecutorInstructions,
  MAX_EXECUTOR_PAYLOAD_SIZE,
} from "..";
import {
  getSizeOfTransaction,
  TransactionBuilder,
} from "@pythnetwork/solana-utils";

it("Unit test for getSizeOfTransaction", async () => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const pythProgram = pythOracleProgram(
    getPythProgramKeyForCluster(cluster),
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions(),
    ),
  );

  const payer = new Keypair();
  const productAccount = PublicKey.unique();

  const ixsToSend: TransactionInstruction[] = [];

  ixsToSend.push(
    await pythProgram.methods
      .addProduct({
        asset_type: "Crypto",
        base: "ETH",
        description: "ETH/USD",
        quote_currency: "USD",
        symbol: "Crypto.ETH/USD",
        generic_symbol: "ETHUSD",
      })
      .accounts({
        fundingAccount: payer.publicKey,
        productAccount,
        tailMappingAccount: PublicKey.unique(),
      })
      .instruction(),
  );

  ixsToSend.push(
    await pythProgram.methods
      .addPrice(-8, 1)
      .accounts({
        fundingAccount: payer.publicKey,
        productAccount,
        priceAccount: PublicKey.unique(),
      })
      .instruction(),
  );

  const transaction = new Transaction();
  for (let ix of ixsToSend) {
    transaction.add(ix);
  }

  transaction.recentBlockhash = "GqdFtdM7zzWw33YyHtBNwPhyBsdYKcfm9gT47bWnbHvs"; // Mock blockhash from devnet
  transaction.feePayer = payer.publicKey;
  expect(transaction.serialize({ requireAllSignatures: false }).length).toBe(
    getSizeOfTransaction(ixsToSend, false),
  );
});

it("Unit test for getSizeOfTransaction", async () => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const pythProgram = pythOracleProgram(
    getPythProgramKeyForCluster(cluster),
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions(),
    ),
  );
  const ixsToSend: TransactionInstruction[] = [];
  const payer = new Keypair();

  for (let i = 0; i < 100; i++) {
    ixsToSend.push(
      await pythProgram.methods
        .addPublisher(PublicKey.unique())
        .accounts({
          fundingAccount: payer.publicKey,
          priceAccount: PublicKey.unique(),
        })
        .instruction(),
    );
  }

  const txToSend: Transaction[] =
    TransactionBuilder.batchIntoLegacyTransactions(ixsToSend, {
      computeUnitPriceMicroLamports: 50000,
    });
  expect(
    txToSend.map((tx) => tx.instructions.length).reduce((a, b) => a + b),
  ).toBe(ixsToSend.length + txToSend.length);
  expect(
    txToSend.every(
      (tx) => getSizeOfTransaction(tx.instructions, false) <= PACKET_DATA_SIZE,
    ),
  ).toBeTruthy();

  for (let tx of txToSend) {
    tx.recentBlockhash = "GqdFtdM7zzWw33YyHtBNwPhyBsdYKcfm9gT47bWnbHvs"; // Mock blockhash from devnet
    tx.feePayer = payer.publicKey;
    expect(tx.serialize({ requireAllSignatures: false }).length).toBe(
      getSizeOfTransaction(tx.instructions, false),
    );
  }

  const batches: TransactionInstruction[][] =
    batchIntoExecutorPayload(ixsToSend);
  expect(batches.map((batch) => batch.length).reduce((a, b) => a + b)).toBe(
    ixsToSend.length,
  );
  expect(
    batches.every(
      (batch) =>
        getSizeOfExecutorInstructions(batch) <= MAX_EXECUTOR_PAYLOAD_SIZE,
    ),
  ).toBeTruthy();
});
