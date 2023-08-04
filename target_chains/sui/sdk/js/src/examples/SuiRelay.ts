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
import {
  getProvider,
  getWormholePackageId,
  getPythPackageId,
  updatePriceFeedWithAccumulator
} from "../helpers"
import { SuiPriceServiceConnection } from "../index";
//import { AptosAccount, AptosClient, TxnBuilderTypes } from "aptos";

const argv = yargs(hideBin(process.argv))
  .option("price-id", {
    description:
      "Space separated price feed id (in hex) to fetch" +
      " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "string",
    required: true,
  })
  .option("price-info-object", {
    description: "Sui price info object corresponding to price-id",
    type: "string",
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

  // only use the first acc msg for now
  let accumulator_message = Buffer.from(priceFeedUpdateData[0]).toString("hex");

  const provider = getProvider(argv["full-node"])
  const wormholeStateId = argv["wormhole-state-id"]
  const pythStateId = argv["pyth-state-id"]
  const wormholePackageId = await getWormholePackageId(wormholeStateId, provider)
  const pythPackageId = await getPythPackageId(pythStateId, provider)

  if (process.env.SUI_KEY === undefined) {
    throw new Error(`SUI_KEY environment variable should be set.`);
  }

  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(process.env.SUI_KEY, "hex")),
    provider
  );
  console.log(wallet.getAddress());

  let result = await updatePriceFeedWithAccumulator(
    wallet,
    accumulator_message,
    argv["price-info-object"],
    wormholePackageId,
    wormholeStateId,
    pythPackageId,
    pythStateId,
  )

  console.dir(result, { depth: null });
}

run();
