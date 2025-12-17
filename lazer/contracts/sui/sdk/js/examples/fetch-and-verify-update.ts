import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { addParseAndVerifyLeEcdsaUpdateCall } from "../src/client.js";

async function getOneLeEcdsaUpdate(token: string) {
  const lazer = await PythLazerClient.create({
    token,
  });

  const latestPrice = await lazer.getLatestPrice({
    priceFeedIds: [1],
    properties: ["price", "bestBidPrice", "bestAskPrice", "exponent"],
    formats: ["leEcdsa"],
    channel: "fixed_rate@200ms",
    jsonBinaryEncoding: "hex",
  });

  return latestPrice;
}

async function main() {
  const args = await yargs(hideBin(process.argv))
    .option("fullnodeUrl", {
      type: "string",
      description:
        "URL of the full Sui node RPC endpoint. e.g: https://fullnode.testnet.sui.io:443",
      demandOption: true,
    })
    .option("packageId", {
      type: "string",
      description: "Lazer contract package ID",
      demandOption: true,
    })
    .option("stateObjectId", {
      type: "string",
      description: "Lazer contract shared State object ID",
      demandOption: true,
    })
    .option("lazerUrls", {
      type: "array",
      string: true,
      description: "Lazer WebSocket URLs",
      default: [
        "wss://pyth-lazer-0.dourolabs.app/v1/stream",
        "wss://pyth-lazer-1.dourolabs.app/v1/stream",
      ],
    })
    .option("lazerToken", {
      type: "string",
      description: "Lazer authentication token",
      demandOption: true,
    })
    .help()
    .parseAsync();

  // Defined as a dependency in turbo.json
  // eslint-disable-next-line n/no-process-env
  if (process.env.SUI_KEY === undefined) {
    throw new Error(
      `SUI_KEY environment variable should be set to your Sui private key in hex format.`,
    );
  }

  const provider = new SuiClient({ url: args.fullnodeUrl });

  // Fetch the price update
  const update = await getOneLeEcdsaUpdate(args.lazerToken);

  // Build the Sui transaction
  const tx = new Transaction();

  // Add the parse and verify call
  addParseAndVerifyLeEcdsaUpdateCall({
    tx,
    packageId: args.packageId,
    stateObjectId: args.stateObjectId,
    updateBytes: Buffer.from(update.leEcdsa?.data ?? "", "hex"),
  });

  // --- You can add more calls to the transaction that consume the parsed update here ---

  const wallet = Ed25519Keypair.fromSecretKey(
    // eslint-disable-next-line n/no-process-env
    Buffer.from(process.env.SUI_KEY, "hex"),
  );
  const res = await provider.signAndExecuteTransaction({
    signer: wallet,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });

  // eslint-disable-next-line no-console
  console.log("Execution result:", JSON.stringify(res, undefined, 2));
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
  throw error;
});
