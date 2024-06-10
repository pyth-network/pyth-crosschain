import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { HermesClient } from "../HermesClient";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const argv = yargs(hideBin(process.argv))
  .option("endpoint", {
    description:
      "Endpoint URL for the price service. e.g: https://endpoint/example",
    type: "string",
    required: true,
  })
  .option("price-ids", {
    description:
      "Space separated price feed ids (in hex without leading 0x) to fetch." +
      " e.g: f9c0172ba10dfa4d19088d...",
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
  const connection = new HermesClient(argv.endpoint);

  const priceIds = argv.priceIds as string[];

  // Get price feeds
  const priceFeeds = await connection.getPriceFeeds({
    query: "btc",
    filter: "crypto",
  });
  console.log(priceFeeds);

  // Latest price updates
  const priceUpdates = await connection.getLatestPriceUpdates(priceIds);
  console.log(priceUpdates);

  // Streaming price updates
  const eventSource = await connection.getPriceUpdatesStream(priceIds, {
    encoding: "hex",
    parsed: true,
    allowUnordered: true,
    benchmarksOnly: true,
  });

  eventSource.onmessage = (event) => {
    console.log("Received price update:", event.data);
  };

  eventSource.onerror = (error) => {
    console.error("Error receiving updates:", error);
    eventSource.close();
  };

  await sleep(5000);

  // To stop listening to the updates, you can call eventSource.close();
  console.log("Closing event source.");
  eventSource.close();
}

run();
