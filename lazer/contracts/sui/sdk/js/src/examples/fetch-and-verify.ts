/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */

import process from "node:process";

import { SuiClient } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { addParseAndVerifyLeEcdsaUpdateCall } from "../index.js";

const { fullnodeUrl, stateId, lazerToken } = await yargs(hideBin(process.argv))
  .option("fullnode-url", {
    type: "string",
    description:
      "URL of the full Sui node RPC endpoint. e.g: https://fullnode.testnet.sui.io:443",
    demandOption: true,
  })
  .option("state-id", {
    type: "string",
    description: "Lazer contract shared State object ID",
    demandOption: true,
  })
  .option("lazer-token", {
    type: "string",
    description: "Lazer authentication token",
    demandOption: true,
  })
  .help()
  .parseAsync();

// eslint-disable-next-line n/no-process-env
if (!process.env.SUI_KEY) {
  throw new Error(
    "'SUI_KEY' environment variable should be set to your Sui private key in Bech32 format.",
  );
}
// eslint-disable-next-line n/no-process-env
const keypair = decodeSuiPrivateKey(process.env.SUI_KEY);
const signer = Ed25519Keypair.fromSecretKey(keypair.secretKey);

/////////////////////////////////////////////////////////////////////////////////////////

// Steps for fetching and verifying the price update:

// 1. Fetch the price update from Pyth Lazer in "leEcdsa" format:
const lazer = await PythLazerClient.create({ token: lazerToken });
const latestPrice = await lazer.getLatestPrice({
  priceFeedIds: [1],
  properties: ["price", "bestBidPrice", "bestAskPrice", "exponent"],
  formats: ["leEcdsa"],
  channel: "fixed_rate@200ms",
  jsonBinaryEncoding: "hex",
});
const update = Buffer.from(latestPrice.leEcdsa?.data ?? "", "hex");

// 2. Create a new Sui transaction:
const client = new SuiClient({ url: fullnodeUrl });
const tx = new Transaction();

// 3. Add the parse and verify call:
const verifiedUpdate = await addParseAndVerifyLeEcdsaUpdateCall({
  client,
  tx,
  stateObjectId: stateId,
  update,
});

// 4. Consume `verifiedUpdate` in your own contract with additional calls...

// 5. Sign and execute the transaction:
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer,
});

console.log("Result:", JSON.stringify(result, undefined, 2));
