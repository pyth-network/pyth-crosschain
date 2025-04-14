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
  // Optionally use an account lookup table to reduce tx sizes.
  const addressLookupTableAccount = new PublicKey(
    "5DNCErWQFBdvCxWQXaC1mrEFsvL3ftrzZ2gVZWNybaSX"
  );
  // Use a stable treasury ID of 0, since its address is indexed in the address lookup table.
  // This is a tx size optimization and is optional. If not provided, a random treasury account will be used.
  const treasuryId = 0;
  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet,
    treasuryId,
  });

  // Get the price update from hermes
  const priceUpdateData = await getPriceUpdateData();
  console.log(`Posting price update: ${priceUpdateData}`);

  // If closeUpdateAccounts = true, the builder will automatically generate instructions to close the ephemeral price update accounts
  // at the end of the transaction. Closing the accounts will reclaim their rent.
  // The example is using closeUpdateAccounts = false so you can easily look up the price update account in an explorer.
  const lookupTableAccount =
    (await connection.getAddressLookupTable(addressLookupTableAccount)).value ??
    undefined;
  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder(
    {
      closeUpdateAccounts: false,
    },
    lookupTableAccount
  );
  // Post the price updates to ephemeral accounts, one per price feed.
  await transactionBuilder.addPostPriceUpdates(priceUpdateData);
  console.log(
    "The SOL/USD price update will get posted to:",
    transactionBuilder.getPriceUpdateAccount(SOL_PRICE_FEED_ID).toBase58()
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
  sendTransactions(
    await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 100000,
      tightComputeBudget: true,
    }),
    pythSolanaReceiver.connection,
    pythSolanaReceiver.wallet
  );
}

// Fetch price update data from Hermes
async function getPriceUpdateData() {
  const priceServiceConnection = new HermesClient(
    "https://hermes.pyth.network/",
    {}
  );

  const response = await priceServiceConnection.getLatestPriceUpdates(
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
