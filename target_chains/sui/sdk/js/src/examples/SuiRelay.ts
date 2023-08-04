import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  Connection,
  Ed25519Keypair,
  JsonRpcProvider,
  ObjectId,
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
} from "@mysten/sui.js";
import {getProvider, getWormholePackageId, getPythPackageId} from "../helpers"
import { SuiPriceServiceConnection } from "../index";
//import { AptosAccount, AptosClient, TxnBuilderTypes } from "aptos";

const argv = yargs(hideBin(process.argv))
  .option("price-ids", {
    description:
      "Space separated price feed ids (in hex) to fetch" +
      " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "array",
    required: true,
  })
  .option("price-service", {
    description:
      "Endpoint URL for the price service. e.g: https://endpoint/example",
    type: "string",
    required: true,
  })
  .option("full-node", {
    description: "URL of the full Sui node RPC endpoint.",
    type: "string",
    required: true,
  })
  .option("pyth-state-id", {
    description: "Pyth state object id.",
    type: "string",
    required: true,
  })
  .option("wormhole-state-id", {
    description: "Wormhole state object id.",
    type: "string",
    required: true,
  })
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  })
  .parseSync();

async function run() {
  // Fetch the latest price feed update data from the Price Service
  const connection = new SuiPriceServiceConnection(argv.priceService);
  const priceFeedUpdateData = await connection.getPriceFeedsUpdateData(
    argv.priceIds as string[]
  );

  const provider = getProvider(argv["full-node"])
  const wormholePackageId = getWormholePackageId(argv["wormhole-state-id"], provider)
  const pythPackageId = getPythPackageId(argv["pyth-state-id"], provider)

  // Update the Pyth Contract using this update data
  if (process.env.SUI_KEY === undefined) {
    throw new Error(`SUI_KEY environment variable should be set.`);
  }


  // const sender = new AptosAccount(Buffer.from(process.env.SUI_KEY, "hex"));
  // const client = new AptosClient(argv.fullNode);
  // const result = await client.generateSignSubmitWaitForTransaction(
  //   sender,
  //   new TxnBuilderTypes.TransactionPayloadEntryFunction(
  //     TxnBuilderTypes.EntryFunction.natural(
  //       argv.pythContract + "::pyth",
  //       "update_price_feeds_with_funder",
  //       [],
  //       [SuiPriceServiceConnection.serializeUpdateData(priceFeedUpdateData)]
  //     )
  //   )
  // );
  console.dir(result, { depth: null });
}

run();
