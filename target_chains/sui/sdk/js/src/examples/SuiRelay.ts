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

// example usage for testnet with accumulator message (with hermes price service endpoint):
//
// SUI_KEY=YOUR_PRIV_KEY_IN_HEX npx ts-node SuiRelay.ts --price-id "5a035d5440f5c163069af66062bac6c79377bf88396fa27e6067bfca8096d280" \
// --price-service "https://hermes-beta.pyth.network" \
// --full-node "https://fullnode.testnet.sui.io:443" \
// --pyth-state-id "0xd3e79c2c083b934e78b3bd58a490ec6b092561954da6e7322e1e2b3c8abfddc0" \
// --wormhole-state-id "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790"
const argv = yargs(hideBin(process.argv))
  .option("price-id", {
    description:
      "Space separated price feed id (in hex) to fetch" +
      " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "string",
    demandOption: true,
  })
  .option("price-service", {
    description:
      "Endpoint URL for the price service. e.g: https://endpoint/example",
    type: "string",
    demandOption: true,
  })
  .option("full-node", {
    description: "URL of the full Sui node RPC endpoint.",
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
  console.log("argv.priceIds: ", argv.priceId);
  const priceFeedUpdateData = await connection.getPriceFeedsUpdateData([
    argv.priceId,
  ]);

  const provider = getProvider(argv["full-node"]);
  const wormholeStateId = argv["wormhole-state-id"];
  const pythStateId = argv["pyth-state-id"];

  const client = new SuiPythClient(provider, pythStateId, wormholeStateId);
  const tx = new TransactionBlock();
  await client.updatePriceFeeds(tx, priceFeedUpdateData, [argv.priceId]);

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
  const gasCost = await wallet.getGasCostEstimation(txBlock);
  tx.setGasBudget(gasCost * BigInt(2));
  const result = await wallet.signAndExecuteTransactionBlock(txBlock);
  console.dir(result, { depth: null });
}

run();
