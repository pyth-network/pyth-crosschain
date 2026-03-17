import { Buffer } from "node:buffer";

import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { IotaPythClient } from "../client";
import { IotaPriceServiceConnection } from "../index";

const argvPromise = yargs(hideBin(process.argv))
  .option("feed-id", {
    demandOption: true,
    description:
      "Price feed ids to update without the leading 0x (e.g f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b). Can be provided multiple times for multiple feed updates",
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
      "URL of the full IOTA node RPC endpoint. e.g: https://api.testnet.iota.cafe/",
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
  return new IotaClient({ url });
}
async function run() {
  if (process.env.IOTA_KEY === undefined) {
    throw new Error(`IOTA_KEY environment variable should be set.`);
  }

  const argv = await argvPromise;

  // Fetch the latest price feed update data from the Price Service
  const connection = new IotaPriceServiceConnection(argv.hermes);
  const feeds = argv["feed-id"] as string[];

  const provider = getProvider(argv["full-node"]);
  const wormholeStateId = argv["wormhole-state-id"];
  const pythStateId = argv["pyth-state-id"];

  const client = new IotaPythClient(provider, pythStateId, wormholeStateId);
  const newFeeds = [];
  const existingFeeds = [];
  for (const feed of feeds) {
    if ((await client.getPriceFeedObjectId(feed)) == undefined) {
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
    Buffer.from(process.env.IOTA_KEY, "hex"),
  );

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
