import crypto from "node:crypto";

// @ts-expect-error
globalThis.crypto = crypto;

import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { getSizeOfCompressedU16, getSizeOfTransaction } from "..";

it("Unit test compressed u16 size", async () => {
  expect(getSizeOfCompressedU16(127)).toBe(1);
  expect(getSizeOfCompressedU16(128)).toBe(2);
  expect(getSizeOfCompressedU16(16_383)).toBe(2);
  expect(getSizeOfCompressedU16(16_384)).toBe(3);
});

it("Unit test for getSizeOfTransaction", () => {
  jest.setTimeout(60_000);

  const payer = new Keypair();

  const ixsToSend: TransactionInstruction[] = [];

  ixsToSend.push(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      lamports: 1_000_000_000,
      newAccountPubkey: PublicKey.unique(),
      programId: SystemProgram.programId,
      space: 100,
    }),
  );

  ixsToSend.push(
    SystemProgram.createAccountWithSeed({
      basePubkey: PublicKey.unique(),
      fromPubkey: PublicKey.unique(),
      lamports: 1_000_000_000,
      newAccountPubkey: PublicKey.unique(),
      programId: SystemProgram.programId,
      seed: "seed",
      space: 100,
    }),
  );

  ixsToSend.push(
    new TransactionInstruction({
      data: Buffer.from([1, 2, 3]),
      keys: [{ isSigner: true, isWritable: true, pubkey: PublicKey.unique() }],
      programId: PublicKey.unique(),
    }),
  );

  ixsToSend.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 69 }));

  ixsToSend.push(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
  );

  const transaction = new Transaction();
  for (const ix of ixsToSend) {
    transaction.add(ix);
  }

  transaction.recentBlockhash = "GqdFtdM7zzWw33YyHtBNwPhyBsdYKcfm9gT47bWnbHvs"; // Mock blockhash from devnet
  transaction.feePayer = payer.publicKey;
  expect(transaction.serialize({ requireAllSignatures: false })).toHaveLength(
    getSizeOfTransaction(ixsToSend, false),
  );

  const versionedTransaction = new VersionedTransaction(
    new TransactionMessage({
      instructions: ixsToSend,
      payerKey: payer.publicKey,
      recentBlockhash: transaction.recentBlockhash,
    }).compileToV0Message(),
  );
  expect(versionedTransaction.serialize()).toHaveLength(
    getSizeOfTransaction(ixsToSend),
  );

  const addressLookupTable: AddressLookupTableAccount =
    new AddressLookupTableAccount({
      key: PublicKey.unique(),
      state: {
        addresses: [
          SystemProgram.programId,
          ComputeBudgetProgram.programId,
          ...(ixsToSend?.[0]?.keys.map((key) => key.pubkey) ?? []),
          ...(ixsToSend?.[1]?.keys.map((key) => key.pubkey) ?? []),
          ...(ixsToSend?.[2]?.keys.map((key) => key.pubkey) ?? []),
        ],
        deactivationSlot: BigInt(0),
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
      },
    });

  const versionedTransactionWithAlt = new VersionedTransaction(
    new TransactionMessage({
      instructions: ixsToSend,
      payerKey: payer.publicKey,
      recentBlockhash: transaction.recentBlockhash,
    }).compileToV0Message([addressLookupTable]),
  );

  expect(versionedTransactionWithAlt.serialize()).toHaveLength(
    getSizeOfTransaction(ixsToSend, true, addressLookupTable),
  );
});
