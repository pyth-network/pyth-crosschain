// biome-ignore-all lint/nursery/noUndeclaredEnvVars lint/style/noProcessEnv lint/suspicious/useAwait: Example file uses env vars
import fs from "node:fs";
import os from "node:os";
import { Wallet } from "@coral-xyz/anchor";
import { HermesClient } from "@pythnetwork/hermes-client";
import { sendTransactions } from "@pythnetwork/solana-utils";
import type { PublicKey } from "@solana/web3.js";
import { Connection, Keypair } from "@solana/web3.js";
import type { InstructionWithEphemeralSigners } from "../";
import { PythSolanaReceiver } from "../";

// Get price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

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
  const priceUpdateData = await getPriceUpdateDataFromOneDayAgo();

  // If closeUpdateAccounts = true, the builder will automatically generate instructions to close the ephemeral price update accounts
  // at the end of the transaction. Closing the accounts will reclaim their rent.
  // The example is using closeUpdateAccounts = false so you can easily look up the price update account in an explorer.
  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
    closeUpdateAccounts: false,
  });
  // Post the price updates to ephemeral accounts, one per price feed.
  await transactionBuilder.addPostPriceUpdates(priceUpdateData);

  await transactionBuilder.addPriceConsumerInstructions(
    async (
      _getPriceUpdateAccount: (priceFeedId: string) => PublicKey,
    ): Promise<InstructionWithEphemeralSigners[]> => {
      // You can generate instructions here that use the price updates posted above.
      // getPriceUpdateAccount(<price feed id>) will give you the account you need.
      // These accounts will be packed into transactions by the builder.
      return [];
    },
  );

  // Send the instructions in the builder in 1 or more transactions.
  // The builder will pack the instructions into transactions automatically.
  sendTransactions(
    await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 100_000,
      tightComputeBudget: true,
    }),
    pythSolanaReceiver.connection,
    pythSolanaReceiver.wallet,
  );
}

// Fetch price update data from Hermes
async function getPriceUpdateDataFromOneDayAgo(): Promise<string[]> {
  const hermesClient = new HermesClient("https://hermes.pyth.network/", {});

  const oneDayAgo = Math.floor(Date.now() / 1000) - 86_400;
  const response = await hermesClient.getPriceUpdatesAtTimestamp(
    oneDayAgo,
    [SOL_PRICE_FEED_ID],
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
