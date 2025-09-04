import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SuiLazerClient } from "../src/client.js";
import { PythLazerClient, Request } from "@pythnetwork/pyth-lazer-sdk";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function getOneLeEcdsaUpdate(urls: string[], token: string | undefined) {
  const config: Parameters<typeof PythLazerClient.create>[0] = {
    urls,
    token: token ?? "",
    numConnections: 1,
  };
  const lazer = await PythLazerClient.create(config);

  const subscription: Request = {
    subscriptionId: 1,
    type: "subscribe",
    priceFeedIds: [1],
    properties: [
      "price",
      "bestBidPrice",
      "bestAskPrice",
      "exponent",
    ],
    formats: ["leEcdsa"],
    channel: "fixed_rate@200ms",
    deliveryFormat: "binary",
    jsonBinaryEncoding: "hex",
  };

  lazer.subscribe(subscription)

  return new Promise<Buffer>((resolve, _) => {
    lazer.addMessageListener((event) => {
      if (event.type === "binary" && event.value.leEcdsa) {
        const buf = event.value.leEcdsa;

        // For the purposes of this example, we only need one update.
        lazer.shutdown();
        resolve(buf);
      }
    });
  });
}

async function main() {
  const args = await yargs(hideBin(process.argv))
    .option("fullnodeUrl", {
      type: "string",
      description: "URL of the full Sui node RPC endpoint. e.g: https://fullnode.testnet.sui.io:443",
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
      type: "string",
      description: "Comma-separated Lazer WebSocket URLs",
      default: "wss://pyth-lazer-0.dourolabs.app/v1/stream,wss://pyth-lazer-1.dourolabs.app/v1/stream",
    })
    .option("token", {
      type: "string",
      description: "Lazer authentication token",
    })
    .help()
    .parseAsync();

  if (process.env.SUI_KEY === undefined) {
    throw new Error(`SUI_KEY environment variable should be set to your Sui private key in hex format.`);
  }

  const lazerUrls = args.lazerUrls.split(",");

  const provider = new SuiClient({ url: args.fullnodeUrl });
  const client = new SuiLazerClient(provider);

  // Fetch the price update
  const updateBytes = await getOneLeEcdsaUpdate(lazerUrls, args.token);

  // Build the Sui transaction
  const tx = new Transaction();

  // Add the parse and verify call
  client.addParseAndVerifyLeEcdsaUpdateCall({
    tx,
    packageId: args.packageId,
    stateObjectId: args.stateObjectId,
    updateBytes,
  });

  // You can add more calls to the transaction that consume the parsed update here

  const wallet = Ed25519Keypair.fromSecretKey(
    Buffer.from(process.env.SUI_KEY, "hex"),
  );
  const res = await provider.signAndExecuteTransaction({
    signer: wallet,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });

  console.log("Execution result:", JSON.stringify(res, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
