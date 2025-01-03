import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { InstructionWithEphemeralSigners, PythSolanaReceiver } from "../";
import { Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import { HermesClient } from "@pythnetwork/hermes-client";
import { sendTransactions } from "@pythnetwork/solana-utils";

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

  // Get the TWAP update from hermes
  const twapUpdateData = await getTwapUpdateData();
  console.log(`Posting TWAP update: ${twapUpdateData}`);

  // Similar to price updates, we'll keep closeUpdateAccounts = false for easy exploration
  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
    closeUpdateAccounts: false,
  });

  // Post the TWAP updates to ephemeral accounts, one per price feed
  await transactionBuilder.addPostTwapUpdates(twapUpdateData);
  console.log(
    `\nThe SOL/USD TWAP update will get posted to: ${transactionBuilder
      .getTwapUpdateAccount(SOL_PRICE_FEED_ID)
      .toBase58()}\n`
  );

  await transactionBuilder.addTwapConsumerInstructions(
    async (
      getTwapUpdateAccount: (priceFeedId: string) => PublicKey
    ): Promise<InstructionWithEphemeralSigners[]> => {
      // You can generate instructions here that use the TWAP updates posted above.
      // getTwapUpdateAccount(<price feed id>) will give you the account you need.
      return [];
    }
  );

  // Send the instructions in the builder in 1 or more transactions
  sendTransactions(
    await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 100000,
      tightComputeBudget: true,
    }),
    pythSolanaReceiver.connection,
    pythSolanaReceiver.wallet
  );
}

// Fetch TWAP update data from Hermes
async function getTwapUpdateData() {
  const hermesConnection = new HermesClient("https://hermes.pyth.network/", {});

  // Request TWAP updates with a 5 minute window (300 seconds)
  const response = await hermesConnection.getLatestTwaps(
    [SOL_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
    300,
    { encoding: "base64" }
  );

  return response.binary.data;
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
