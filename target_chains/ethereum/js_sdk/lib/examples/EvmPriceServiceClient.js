"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const index_1 = require("../index");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
  .option("endpoint", {
    description:
      "Endpoint URL for the Price Service. e.g: https://endpoint/example",
    type: "string",
    required: true,
  })
  .option("price-ids", {
    description:
      "Space separated price feed ids (in hex) to fetch" +
      " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "array",
    required: true,
  })
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  })
  .parseSync();
async function run() {
  const connection = new index_1.EvmPriceServiceConnection(argv.endpoint, {
    logger: console, // Providing logger will allow the connection to log its events.
  });
  const priceIds = argv.priceIds;
  console.log(priceIds);
  const priceFeeds = await connection.getLatestPriceFeeds(priceIds);
  console.log(priceFeeds);
  console.log(priceFeeds?.at(0)?.getPriceNoOlderThan(60));
  const updateData = await connection.getPriceFeedsUpdateData(priceIds);
  console.log(updateData);
  console.log("Subscribing to price feed updates.");
  await connection.subscribePriceFeedUpdates(priceIds, (priceFeed) => {
    console.log(
      `Current price for ${priceFeed.id}: ${JSON.stringify(
        priceFeed.getPriceNoOlderThan(60)
      )}.`
    );
  });
  await sleep(600000);
  // To close the websocket you should either unsubscribe from all
  // price feeds or call `connection.closeWebSocket()` directly.
  console.log("Unsubscribing from price feed updates.");
  await connection.unsubscribePriceFeedUpdates(priceIds);
}
run();
