import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import {
  InstructionWithEphemeralSigners,
  PythSolanaReceiver,
} from "@pythnetwork/pyth-solana-receiver";
import { Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import { TransactionBuilder, sendTransactions } from "..";
import {
  SearcherClient,
  searcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import { isError } from "jito-ts/dist/sdk/block-engine/utils";

// Get price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const ETH_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

let keypairFile = "";
if (process.env["SOLANA_KEYPAIR"]) {
  keypairFile = process.env["SOLANA_KEYPAIR"];
} else {
  keypairFile = `${os.homedir()}/.config/solana/id.json`;
}

const jitoKeypairFile = `${os.homedir()}/.config/solana/jito.json`;

async function main() {
  const connection = new Connection("http://api.mainnet-beta.solana.com");
  const keypair = await loadKeypairFromFile(keypairFile);
  const jitoKeypair = await loadKeypairFromFile(jitoKeypairFile);
  console.log(
    `Sending transactions from account: ${keypair.publicKey.toBase58()}`
  );
  const wallet = new Wallet(keypair);
  const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });

  const transactionBuilder = new TransactionBuilder(
    wallet.payer.publicKey,
    connection
  );

  const c = searcherClient("mainnet.block-engine.jito.wtf", jitoKeypair);
  const tips = await c.getTipAccounts();
  console.log(tips);

  transactionBuilder.addInstruction({
    instruction: SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: keypair.publicKey,
      lamports: 5000,
    }),
    signers: [],
    computeUnits: 500,
  });

  const transactions = await transactionBuilder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: 150000,
    tightComputeBudget: true,
  });
  transactions[0].tx.sign([keypair]);
  const resp = await connection.getLatestBlockhash("confirmed");

  let bundle = new Bundle(
    transactions.map((x) => x.tx),
    2
  );
  let maybeBundle = bundle.addTipTx(
    keypair,
    100000,
    new PublicKey("ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt"),
    resp.blockhash
  );

  if (isError(maybeBundle)) {
    throw maybeBundle;
  }

  console.log(await c.sendBundle(maybeBundle));

  onBundleResult(c);

  //   // Send the instructions in the builder in 1 or more transactions.
  //   // The builder will pack the instructions into transactions automatically.
  //   await sendTransactions(await transactionBuilder.buildVersionedTransactions({computeUnitPriceMicroLamports:150000, tightComputeBudget: true}), connection, wallet)
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

// Load a solana keypair from an id.json file
async function loadKeypairFromFile(filePath: string): Promise<Keypair> {
  try {
    const keypairData = JSON.parse(
      await fs.promises.readFile(filePath, "utf8")
    );
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch (error) {
    throw new Error(`Error loading keypair from file: ${error}`);
  }
}
main();
