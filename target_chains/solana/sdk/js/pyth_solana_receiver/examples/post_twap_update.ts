import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { InstructionWithEphemeralSigners, PythSolanaReceiver } from "../";
import { Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import { HermesClient } from "@pythnetwork/hermes-client";

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
  // const priceUpdateData = await getTwapUpdateData();
  const twapUpdateData = [
    "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",
  ];
  console.log(`Posting price update: ${twapUpdateData}`);

  // If closeUpdateAccounts = true, the builder will automatically generate instructions to close the ephemeral price update accounts
  // at the end of the transaction. Closing the accounts will reclaim their rent.
  // The example is using closeUpdateAccounts = false so you can easily look up the price update account in an explorer.
  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
    closeUpdateAccounts: false,
  });
  // Post the price updates to ephemeral accounts, one per price feed.
  await transactionBuilder.addPostTwapUpdates(twapUpdateData);
  console.log(
    "The SOL/USD TWAP price will get posted to:",
    transactionBuilder.getTwapUpdateAccount(SOL_PRICE_FEED_ID).toBase58()
  );

  await transactionBuilder.addPriceConsumerInstructions(
    async (
      getPriceUpdateAccount: (priceFeedId: string) => PublicKey
    ): Promise<InstructionWithEphemeralSigners[]> => {
      // You can generate instructions here that use the price updates posted above.
      // getTwapUpdateAccount(<price feed id>) will give you the account you need.
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
async function getTwapUpdateData() {
  const hermes = new HermesClient("https://hermes.pyth.network/", {});

  const response = await hermes.getLatestTwaps(
    [SOL_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
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
