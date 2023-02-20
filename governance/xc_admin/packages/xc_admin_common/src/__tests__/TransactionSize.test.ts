import { AnchorProvider, Wallet } from "@project-serum/anchor";
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
  batchIntoTransactions,
  getSizeOfCompressedU16,
  getSizeOfTransaction,
  MultisigInstructionProgram,
  MultisigParser,
} from "..";
import { PythMultisigInstruction } from "../multisig_transaction/PythMultisigInstruction";

it("Unit test compressed u16 size", async () => {
  expect(getSizeOfCompressedU16(127)).toBe(1);
  expect(getSizeOfCompressedU16(128)).toBe(2);
  expect(getSizeOfCompressedU16(16383)).toBe(2);
  expect(getSizeOfCompressedU16(16384)).toBe(3);
});

it("Unit test for getSizeOfTransaction", async () => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";
  const pythProgram = pythOracleProgram(
    getPythProgramKeyForCluster(cluster),
    new AnchorProvider(
      new Connection(getPythClusterApiUrl(cluster)),
      new Wallet(new Keypair()),
      AnchorProvider.defaultOptions()
    )
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
      .instruction()
  );

  ixsToSend.push(
    await pythProgram.methods
      .addPrice(-8, 1)
      .accounts({
        fundingAccount: payer.publicKey,
        productAccount,
        priceAccount: PublicKey.unique(),
      })
      .instruction()
  );

  const transaction = new Transaction();
  for (let ix of ixsToSend) {
    transaction.add(ix);
  }

  transaction.recentBlockhash = "GqdFtdM7zzWw33YyHtBNwPhyBsdYKcfm9gT47bWnbHvs"; // Mock blockhash from devnet
  transaction.feePayer = payer.publicKey;
  expect(transaction.serialize({ requireAllSignatures: false }).length).toBe(
    getSizeOfTransaction(ixsToSend)
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
      AnchorProvider.defaultOptions()
    )
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
        .instruction()
    );
  }

  const txToSend: Transaction[] = batchIntoTransactions(
    ixsToSend,
    payer.publicKey
  );
  expect(
    txToSend.map((tx) => tx.instructions.length).reduce((a, b) => a + b)
  ).toBe(ixsToSend.length);
  expect(
    txToSend.every(
      (tx) => getSizeOfTransaction(tx.instructions) <= PACKET_DATA_SIZE
    )
  ).toBeTruthy();

  for (let tx of txToSend) {
    tx.recentBlockhash = "GqdFtdM7zzWw33YyHtBNwPhyBsdYKcfm9gT47bWnbHvs"; // Mock blockhash from devnet
    tx.feePayer = payer.publicKey;
    expect(tx.serialize({ requireAllSignatures: false }).length).toBe(
      getSizeOfTransaction(tx.instructions)
    );
  }
});
