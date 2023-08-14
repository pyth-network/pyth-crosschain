import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  Connection,
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
  TransactionBlock,
} from "@mysten/sui.js";

import { SuiPythClient } from "../client";
import { SuiPriceServiceConnection } from "../index";

const argv = yargs(hideBin(process.argv))
  .option("price-feed", {
    description:
      "Price feed id (in hex) to fetch e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "string",
    demandOption: true,
  })
  .option("price-service", {
    description:
      "Endpoint URL for the price service. e.g: https://xc-mainnet.pyth.network",
    type: "string",
    demandOption: true,
  })
  .option("full-node", {
    description:
      "URL of the full Sui node RPC endpoint. e.g: https://fullnode.testnet.sui.io:443",
    type: "string",
    demandOption: true,
  })
  .option("pyth-state-id", {
    description: "Pyth state object id.",
    type: "string",
    demandOption: true,
  })
  .option("wormhole-state-id", {
    description: "Wormhole state object id.",
    type: "string",
    demandOption: true,
  })
  .parseSync();

export function getProvider(url: string) {
  return new JsonRpcProvider(new Connection({ fullnode: url }));
}
async function run() {
  if (process.env.SUI_KEY === undefined) {
    throw new Error(`SUI_KEY environment variable should be set.`);
  }

  // Fetch the latest price feed update data from the Price Service
  const connection = new SuiPriceServiceConnection(argv["price-service"]);
  const priceFeedUpdateData = await connection.getPriceFeedsUpdateData([
    argv["price-feed"],
  ]);

  const provider = getProvider(argv["full-node"]);
  const wormholeStateId = argv["wormhole-state-id"];
  const pythStateId = argv["pyth-state-id"];

  const client = new SuiPythClient(provider, pythStateId, wormholeStateId);
  const tx = new TransactionBlock();
  await client.updatePriceFeeds(tx, priceFeedUpdateData, [argv["price-feed"]]);

  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(process.env.SUI_KEY, "hex")),
    provider
  );

  const txBlock = {
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  };
  const result = await wallet.signAndExecuteTransactionBlock(txBlock);
  console.dir(result, { depth: null });
}

run();
