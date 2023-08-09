import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Ed25519Keypair, RawSigner } from "@mysten/sui.js";
import {
  getProvider,
  getWormholePackageId,
  getPythPackageId,
  updatePriceFeed,
} from "../helpers";
import { SuiPriceServiceConnection } from "../index";

// example usage for testnet with accumulator message (with hermes price service endpoint):
//
//      SUI_KEY=YOUR_PRIV_KEY npx ts-node SuiRelay.ts --price-id "0x5a035d5440f5c163069af66062bac6c79377bf88396fa27e6067bfca8096d280" --price-info-object-id "0x848d1c941e117f515757b77aa562eee8bb179eee6f37ec6dad97ae0279ff4bd4" --price-service "https://hermes-beta.pyth.network" --full-node "https://fullnode.testnet.sui.io:443" --pyth-state-id "0xd3e79c2c083b934e78b3bd58a490ec6b092561954da6e7322e1e2b3c8abfddc0" --wormhole-state-id "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790"
const argv = yargs(hideBin(process.argv))
  .option("price-id", {
    description:
      "Space separated price feed id (in hex) to fetch" +
      " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "string",
    required: true,
  })
  .option("price-info-object-id", {
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
  .parse();

async function run() {
  // Fetch the latest price feed update data from the Price Service
  //@ts-ignore
  const connection = new SuiPriceServiceConnection(argv.priceService);
  //@ts-ignore
  console.log("argv.priceIds: ", argv.priceId);
  const priceFeedUpdateData = await connection.getPriceFeedsUpdateData(
    //@ts-ignore
    [argv.priceId]
  );
  console.log("priceFeedUpdateData: ", priceFeedUpdateData);
  // only use the first acc msg for now
  let update_msg = Buffer.from(priceFeedUpdateData[0]).toString("base64");

  //@ts-ignore
  const provider = getProvider(argv["full-node"]);
  //@ts-ignore
  const wormholeStateId = argv["wormhole-state-id"];
  //@ts-ignore
  const pythStateId = argv["pyth-state-id"];

  const wormholePackageId = await getWormholePackageId(
    wormholeStateId,
    provider
  );

  const pythPackageId = await getPythPackageId(pythStateId, provider);

  if (process.env.SUI_KEY === undefined) {
    throw new Error(`SUI_KEY environment variable should be set.`);
  }

  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(process.env.SUI_KEY, "hex")),
    provider
  );

  console.log("wallet public key: ", wallet.getAddress());

  let result = await updatePriceFeed(
    wallet,
    update_msg,
    //@ts-ignore
    argv["price-info-object-id"],
    wormholePackageId,
    wormholeStateId,
    pythPackageId,
    pythStateId
  );

  console.dir(result, { depth: null });
}

run();
