import { Connection, Keypair } from "@solana/web3.js";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { sendTransactionsJito } from "..";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import {
  SearcherClient,
  searcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";

// Get price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

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

  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
    closeUpdateAccounts: true,
  });
  const priceUpdateData = await getPriceUpdateData();
  await transactionBuilder.addPostPriceUpdates(priceUpdateData);

  const c = searcherClient("mainnet.block-engine.jito.wtf", jitoKeypair);

  const transactions = await transactionBuilder.buildVersionedTransactions({
    tightComputeBudget: true,
    jitoTipLamports: 100000,
  });

  await sendTransactionsJito(transactions, c, wallet);

  onBundleResult(c);
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
    console.log(keypairData);
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch (error) {
    throw new Error(`Error loading keypair from file: ${error}`);
  }
}
main();

async function getPriceUpdateData() {
  const priceServiceConnection = new PriceServiceConnection(
    "https://hermes.pyth.network/",
    { priceFeedRequestConfig: { binary: true } }
  );

  return await priceServiceConnection.getLatestVaas([SOL_PRICE_FEED_ID]);
}
