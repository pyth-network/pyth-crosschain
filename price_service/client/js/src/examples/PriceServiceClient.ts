import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { PriceServiceConnection } from "../index";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const argv = yargs(hideBin(process.argv))
  .option("endpoint", {
    description:
      "Endpoint URL for the price service. e.g: https://endpoint/example",
    required: true,
    type: "string",
  })
  .option("price-ids", {
    description:
      "Space separated price feed ids (in hex without leading 0x) to fetch." +
      " e.g: f9c0172ba10dfa4d19088d...",
    required: true,
    type: "array",
  })
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  })
  .parseSync();

async function run() {
  const connection = new PriceServiceConnection(argv.endpoint, {
    logger: console, // Providing logger will allow the connection to log it's events.
    priceFeedRequestConfig: {
      binary: true,
    },
  });

  const priceIds = argv.priceIds as string[];
  const _priceFeeds = await connection.getLatestPriceFeeds(priceIds);

  await connection.subscribePriceFeedUpdates(priceIds, (priceFeed) => {});

  await sleep(600_000);
  await connection.unsubscribePriceFeedUpdates(priceIds);

  // connection.closeWebSocket();
}

run();
