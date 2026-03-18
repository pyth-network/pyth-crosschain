// biome-ignore-all lint/style/noProcessEnv lint/nursery/noUndeclaredEnvVars: Script uses env vars for configuration
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { Buffer } from "buffer";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { SuiPythClient } from "../client";
import { SuiPriceServiceConnection } from "../index";

const argvPromise = yargs(hideBin(process.argv))
  .option("feed-id", {
    demandOption: true,
    description:
      "Price feed ids to update without the leading 0x (e.g f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b). Can be provided multiple times for multiple feed updates",
    string: true,
    type: "array",
  })
  .option("hermes", {
    demandOption: true,
    description: "Endpoint URL for Hermes. e.g: https://hermes.pyth.network",
    type: "string",
  })
  .option("full-node", {
    demandOption: true,
    description:
      "URL of the full Sui node RPC endpoint. e.g: https://fullnode.testnet.sui.io:443",
    type: "string",
  })
  .option("pyth-state-id", {
    demandOption: true,
    description: "Pyth state object id.",
    type: "string",
  })
  .option("wormhole-state-id", {
    demandOption: true,
    description: "Wormhole state object id.",
    type: "string",
  }).argv;

export function getProvider(url: string) {
  return new SuiClient({ url });
}
async function run() {
  if (process.env.SUI_KEY === undefined) {
    throw new Error(`SUI_KEY environment variable should be set.`);
  }

  const argv = await argvPromise;

  // Fetch the latest price feed update data from the Price Service
  const connection = new SuiPriceServiceConnection(argv.hermes);
  const feeds = argv["feed-id"];
  if (!Array.isArray(feeds)) {
    throw new Error("Not a valid input!");
  }

  const provider = getProvider(argv["full-node"]);
  const wormholeStateId = argv["wormhole-state-id"];
  const pythStateId = argv["pyth-state-id"];

  const client = new SuiPythClient(provider, pythStateId, wormholeStateId);
  const newFeeds = [];
  const existingFeeds = [];
  for (const feed of feeds) {
    if (typeof feed !== "string") {
      throw new Error(`Not a valid string input ${feed}`);
    }
    if ((await client.getPriceFeedObjectId(feed)) === undefined) {
      newFeeds.push(feed);
    } else {
      existingFeeds.push(feed);
    }
  }
  const tx = new Transaction();
  if (existingFeeds.length > 0) {
    const updateData = await connection.getPriceFeedsUpdateData(existingFeeds);
    await client.updatePriceFeeds(tx, updateData, existingFeeds);
  }
  if (newFeeds.length > 0) {
    const updateData = await connection.getPriceFeedsUpdateData(newFeeds);
    await client.createPriceFeed(tx, updateData);
  }

  const wallet = Ed25519Keypair.fromSecretKey(
    Buffer.from(process.env.SUI_KEY, "hex"),
  );
  tx.setGasBudget(1_000_000);
  const _result = await provider.signAndExecuteTransaction({
    options: {
      showEffects: true,
      showEvents: true,
    },
    signer: wallet,
    transaction: tx,
  });
}

run();
