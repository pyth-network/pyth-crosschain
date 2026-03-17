/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { PriceFeedMetadata } from "@pythnetwork/hermes-client";
import { HermesClient } from "@pythnetwork/hermes-client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toPrivateKey } from "../src/core/base";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Update the set of price feeds in a network. Usage: $0")
  .options({
    "chunk-size": {
      default: 150,
      desc: "Chunk size to use for the price feeds, defaults to 150",
      type: "number",
    },
    contract: {
      demandOption: true,
      desc: "Contract to update price feeds for (e.g mumbai_0xff1a0f4744e8582DF1aE09D5611b887B6a12925C)",
      type: "string",
    },
    encoding: {
      choices: ["hex", "base64"],
      default: "hex",
      desc: "Encoding to use for the price feeds (hex or base64), defaults to hex",
      type: "string",
    },
    endpoint: {
      desc: "Hermes endpoint to use, defaults to https://hermes.pyth.network",
      type: "string",
    },
    "private-key": {
      demandOption: true,
      desc: "Private key to sign the transactions with",
      type: "string",
    },
  });

// This script is intended to update all pricefeeds after we deploy pyth pricefeeds contract.
// It will fetch all pricefeeds from hermes and update the pricefeeds contract with the new pricefeeds.
async function main() {
  const argv = await parser.argv;
  let priceFeedsMetadata: PriceFeedMetadata[] = [];
  const client = new HermesClient(
    argv.endpoint || "https://hermes.pyth.network",
  );
  const _contract = DefaultStore.contracts[argv.contract];
  const _privateKey = toPrivateKey(argv["private-key"]);
  const _encoding = argv.encoding || "hex";

  priceFeedsMetadata = await client.getPriceFeeds();

  const priceFeedIds = priceFeedsMetadata.map((feed) => feed.id);

  // We can adjust the chunk size based on the chain. Don't exceed 150 for now.
  // TODO: Add a check for the chain's block gas limit and adjust the chunk size accordingly.
  const chunkSize = argv.chunkSize;
  for (let i = 0; i < priceFeedIds.length; i += chunkSize) {
    const chunk = priceFeedIds.slice(i, i + chunkSize);
    const _updates = await client.getLatestPriceUpdates(chunk, {
      parsed: false,
    });
    // Wait for 2 seconds to avoid rate limiting and nonce collision
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
