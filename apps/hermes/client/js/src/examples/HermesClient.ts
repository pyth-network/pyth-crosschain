import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { HermesClient, PriceUpdate } from "../HermesClient";

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

/**
 * Extracts the endpoint and basic authorization headers from a given URL string.
 *
 * @param {string} urlString - The URL string containing the endpoint and optional basic auth credentials.
 * @returns {{ endpoint: string; headers: HeadersInit }} An object containing the endpoint URL and headers.
 */
function extractBasicAuthorizationHeadersFromUrl(urlString: string): {
  endpoint: string;
  headers: HeadersInit;
} {
  const url = new URL(urlString);
  const headers: HeadersInit = {};

  if (url.username && url.password) {
    headers["Authorization"] = `Basic ${btoa(
      `${url.username}:${url.password}`,
    )}`;
    url.username = "";
    url.password = "";
  }

  return { endpoint: url.toString(), headers };
}

async function run() {
  const { endpoint, headers } = extractBasicAuthorizationHeadersFromUrl(
    argv.endpoint,
  );
  const connection = new HermesClient(endpoint, { headers });

  const priceIds = argv.priceIds as string[];

  // Get price feeds
  console.log(`Price feeds matching "btc" with asset type "crypto":`);
  const priceFeeds = await connection.getPriceFeeds({
    query: "btc",
    assetType: "crypto",
  });
  console.log(priceFeeds);

  // Latest price updates
  console.log(`Latest price updates for price IDs ${priceIds}:`);
  const priceUpdates = await connection.getLatestPriceUpdates(priceIds);
  console.log(priceUpdates);

  // Get the latest 5 second TWAPs
  console.log(`Latest 5 second TWAPs for price IDs ${priceIds}`);
  const twapUpdates = await connection.getLatestTwaps(priceIds, 5);
  console.log(twapUpdates);

  // Streaming price updates
  console.log(`Streaming latest prices for price IDs ${priceIds}...`);
  const eventSource = await connection.getPriceUpdatesStream(priceIds, {
    encoding: "hex",
    parsed: true,
    allowUnordered: false,
    benchmarksOnly: true,
  });

  eventSource.onmessage = (event: MessageEvent<string>) => {
    console.log("Received price update:", event.data);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const priceUpdate = JSON.parse(event.data) as PriceUpdate;
  };

  eventSource.onerror = (error: Event) => {
    console.error("Error receiving updates:", error);
    eventSource.close();
  };

  await sleep(5000);

  // To stop listening to the updates, you can call eventSource.close();
  console.log("Closing event source.");
  eventSource.close();
}

run();
