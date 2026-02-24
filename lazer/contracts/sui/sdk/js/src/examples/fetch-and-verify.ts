/** biome-ignore-all lint/correctness/noUnusedVariables: code example */
/** biome-ignore-all lint/suspicious/noConsole: code example */

import process from "node:process";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { addParseAndVerifyLeEcdsaUpdateCall } from "../index.js";

const {
  network,
  baseUrl,
  stateId: STATE_ID,
  lazerToken: LAZER_TOKEN,
} = await yargs(hideBin(process.argv))
  .option("network", {
    choices: ["mainnet", "testnet", "devnet", "localnet"] as const,
    default: "testnet" as const,
    description: "Sui network name, e.g. 'mainnet'",
  })
  .option("base-url", {
    demandOption: true,
    description:
      "URL of the full Sui node RPC endpoint. e.g: https://fullnode.testnet.sui.io:443",
    type: "string",
  })
  .option("state-id", {
    demandOption: true,
    description: "Lazer contract shared State object ID",
    type: "string",
  })
  .option("lazer-token", {
    demandOption: true,
    description: "Lazer authentication token",
    type: "string",
  })
  .help()
  .parseAsync();

const { SUI_KEY = "" } = process.env;

/////////////////////////////////////////////////////////////////////////////////////////

// Steps for fetching and verifying the price update:

// 1. Fetch the price update from Pyth Lazer in "leEcdsa" format:
const lazer = await PythLazerClient.create({ token: LAZER_TOKEN });
const latestPrice = await lazer.getLatestPrice({
  channel: "fixed_rate@200ms",
  formats: ["leEcdsa"],
  jsonBinaryEncoding: "hex",
  priceFeedIds: [1],
  properties: ["price", "bestBidPrice", "bestAskPrice", "exponent"],
});
const update = Buffer.from(latestPrice.leEcdsa?.data ?? "", "hex");

// 2. Create a new Sui transaction:
const signer = Ed25519Keypair.fromSecretKey(SUI_KEY);
const client = new SuiGrpcClient({ baseUrl, network });
const tx = new Transaction();

// 3. Add the parse and verify call:
const verifiedUpdate = await addParseAndVerifyLeEcdsaUpdateCall({
  client: client.core,
  stateObjectId: STATE_ID,
  tx,
  update,
});

// 4. Consume `verifiedUpdate` in your own contract with additional calls...

// 5. Sign and execute the transaction:
const result = await client.signAndExecuteTransaction({
  signer,
  transaction: tx,
});

console.log("Result:", JSON.stringify(result, undefined, 2));
