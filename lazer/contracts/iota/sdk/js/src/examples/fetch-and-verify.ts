/** biome-ignore-all lint/correctness/noUnusedVariables: code example */
/** biome-ignore-all lint/suspicious/noConsole: code example */

import { Buffer } from "node:buffer";
import process from "node:process";
import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { addParseAndVerifyLeEcdsaUpdateCall } from "../index.js";

const {
  baseUrl,
  stateId: STATE_ID,
  lazerToken: LAZER_TOKEN,
} = await yargs(hideBin(process.argv))
  .option("base-url", {
    demandOption: true,
    description:
      "URL of the full IOTA node RPC endpoint. e.g: https://api.testnet.iota.cafe/",
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

const { IOTA_KEY } = process.env;
if (!IOTA_KEY) {
  throw new Error(
    "'IOTA_KEY' environment variable must be set to your IOTA private key.",
  );
}

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

// 2. Create a new IOTA transaction:
const signer = Ed25519Keypair.fromSecretKey(IOTA_KEY);
const client = new IotaClient({ url: baseUrl });
const tx = new Transaction();

// 3. Add the parse and verify call:
const verifiedUpdate = await addParseAndVerifyLeEcdsaUpdateCall({
  client,
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
