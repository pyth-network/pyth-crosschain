import {
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
  expect(getSizeOfCompressedU16(16383)).toBe(2);
  expect(getSizeOfCompressedU16(16384)).toBe(3);
});

it("Unit test for getSizeOfTransaction", async () => {
  jest.setTimeout(60000);

  const payer = new Keypair();

  const ixsToSend: TransactionInstruction[] = [];

  ixsToSend.push(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: PublicKey.unique(),
      space: 100,
      lamports: 1000000000,
      programId: SystemProgram.programId,
    })
  );

  ixsToSend.push(
    SystemProgram.createAccountWithSeed({
      fromPubkey: PublicKey.unique(),
      basePubkey: PublicKey.unique(),
      seed: "seed",
      newAccountPubkey: PublicKey.unique(),
      space: 100,
      lamports: 1000000000,
      programId: SystemProgram.programId,
    })
  );

  ixsToSend.push(
    new TransactionInstruction({
      keys: [{ pubkey: PublicKey.unique(), isSigner: true, isWritable: true }],
      programId: PublicKey.unique(),
      data: Buffer.from([1, 2, 3]),
    })
  );

  ixsToSend.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 69 }));

  ixsToSend.push(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 })
  );

  const transaction = new Transaction();
  for (let ix of ixsToSend) {
    transaction.add(ix);
  }

  transaction.recentBlockhash = "GqdFtdM7zzWw33YyHtBNwPhyBsdYKcfm9gT47bWnbHvs"; // Mock blockhash from devnet
  transaction.feePayer = payer.publicKey;
  expect(transaction.serialize({ requireAllSignatures: false }).length).toBe(
    getSizeOfTransaction(ixsToSend, false)
  );

  const versionedTransaction = new VersionedTransaction(
    new TransactionMessage({
      recentBlockhash: transaction.recentBlockhash,
      payerKey: payer.publicKey,
      instructions: ixsToSend,
    }).compileToV0Message()
  );
  expect(versionedTransaction.serialize().length).toBe(
    getSizeOfTransaction(ixsToSend)
  );
});
