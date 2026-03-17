import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { PriceUpdate } from "../HermesClient";
import { HermesClient } from "../HermesClient";

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
    headers.Authorization = `Basic ${btoa(`${url.username}:${url.password}`)}`;
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
  const _priceFeeds = await connection.getPriceFeeds({
    assetType: "crypto",
    query: "btc",
  });
  const _priceUpdates = await connection.getLatestPriceUpdates(priceIds);
  const eventSource = await connection.getPriceUpdatesStream(priceIds, {
    allowUnordered: false,
    benchmarksOnly: true,
    encoding: "hex",
    parsed: true,
  });

  eventSource.onmessage = (event: MessageEvent<string>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _priceUpdate = JSON.parse(event.data) as PriceUpdate;
  };

  eventSource.onerror = (error: Event) => {
    eventSource.close();
  };

  await sleep(5000);
  eventSource.close();
}

run();
