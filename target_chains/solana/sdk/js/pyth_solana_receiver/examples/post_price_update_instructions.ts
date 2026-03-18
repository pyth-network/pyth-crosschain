// biome-ignore-all lint/nursery/noUndeclaredEnvVars lint/style/noProcessEnv: Example file uses env vars for configuration
import fs from "node:fs";
import os from "node:os";
import { Wallet } from "@coral-xyz/anchor";
import { HermesClient } from "@pythnetwork/hermes-client";
import { sendTransactions } from "@pythnetwork/solana-utils";
import { Connection, Keypair } from "@solana/web3.js";
import type { InstructionWithEphemeralSigners } from "../";
import { PythSolanaReceiver } from "../";

// Get price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const ETH_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

let keypairFile = "";
if (process.env.SOLANA_KEYPAIR) {
  keypairFile = process.env.SOLANA_KEYPAIR;
} else {
  keypairFile = `${os.homedir()}/.config/solana/id.json`;
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com");
  const keypair = await loadKeypairFromFile(keypairFile);
  const wallet = new Wallet(keypair);
  const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });

  // Get the price update from hermes
  const priceUpdateData = await getPriceUpdateData();

  // Get instructions to post the price update data and to close the accounts later
  const {
    postInstructions,
    closeInstructions,
    // biome-ignore lint/correctness/noUnusedVariables: Kept for future use
    priceFeedIdToPriceUpdateAccount,
  } =
    await pythSolanaReceiver.buildPostPriceUpdateInstructions(priceUpdateData);

  // Put your instructions here
  const consumerInstructions: InstructionWithEphemeralSigners[] = [];

  const transactions = await pythSolanaReceiver.batchIntoVersionedTransactions(
    [...postInstructions, ...consumerInstructions, ...closeInstructions],
    { computeUnitPriceMicroLamports: 100_000, tightComputeBudget: true },
  ); // Put all the instructions together
  await sendTransactions(
    transactions,
    pythSolanaReceiver.connection,
    pythSolanaReceiver.wallet,
  );
}

// Fetch price update data from Hermes
async function getPriceUpdateData() {
  const priceServiceConnection = new HermesClient(
    "https://hermes.pyth.network/",
    {},
  );

  const response = await priceServiceConnection.getLatestPriceUpdates(
    [SOL_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
    { encoding: "base64" },
  );

  return response.binary.data;
}

// Load a solana keypair from an id.json file
async function loadKeypairFromFile(filePath: string): Promise<Keypair> {
  try {
    const keypairData = JSON.parse(
      await fs.promises.readFile(filePath, "utf8"),
    );
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch (error) {
    throw new Error(`Error loading keypair from file: ${error}`);
  }
}

main();
