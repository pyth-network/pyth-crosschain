import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { InstructionWithEphemeralSigners, PythSolanaReceiver } from "../";
import { Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";

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

async function main() {
  const connection = new Connection("https://api.devnet.solana.com");
  const keypair = await loadKeypairFromFile(keypairFile);
  console.log(
    `Sending transactions from account: ${keypair.publicKey.toBase58()}`
  );
  const wallet = new Wallet(keypair);
  const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });

  // Get the price update from hermes
  const priceUpdateData = await getPriceUpdateData();
  console.log(`Posting price update: ${priceUpdateData}`);

  // The shard indicates which set of price feed accounts you wish to update.
  const shardId = 1;

  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
  // Update the price feed accounts for the feed ids in priceUpdateData (in this example, SOL and ETH) and shard id.
  await transactionBuilder.addUpdatePriceFeed(priceUpdateData, shardId);
  console.log(
    "The SOL/USD price update will get posted to:",
    pythSolanaReceiver
      .getPriceFeedAccountAddress(shardId, SOL_PRICE_FEED_ID)
      .toBase58()
  );

  await transactionBuilder.addPriceConsumerInstructions(
    async (
      getPriceUpdateAccount: (priceFeedId: string) => PublicKey
    ): Promise<InstructionWithEphemeralSigners[]> => {
      // You can generate instructions here that use the price updates posted above.
      // getPriceUpdateAccount(<price feed id>) will give you the account you need.
      // These accounts will be packed into transactions by the builder.
      return [];
    }
  );

  // Send the instructions in the builder in 1 or more transactions.
  // The builder will pack the instructions into transactions automatically.
  await pythSolanaReceiver.provider.sendAll(
    await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 100000,
    }),
    { preflightCommitment: "processed" }
  );
}

// Fetch price update data from Hermes
async function getPriceUpdateData() {
  const priceServiceConnection = new PriceServiceConnection(
    "https://hermes.pyth.network/",
    { priceFeedRequestConfig: { binary: true } }
  );

  return await priceServiceConnection.getLatestVaas([
    SOL_PRICE_FEED_ID,
    ETH_PRICE_FEED_ID,
  ]);
}

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
