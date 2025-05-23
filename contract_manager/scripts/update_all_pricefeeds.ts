import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { HermesClient, PriceFeedMetadata } from "@pythnetwork/hermes-client";
import { DefaultStore } from "../src/node/utils/store";
import { toPrivateKey } from "../src/core/base";

const parser = yargs(hideBin(process.argv))
  .usage("Update the set of price feeds in a network. Usage: $0")
  .options({
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to sign the transactions with",
    },
    contract: {
      type: "string",
      demandOption: true,
      desc: "Contract to update price feeds for (e.g mumbai_0xff1a0f4744e8582DF1aE09D5611b887B6a12925C)",
    },
    endpoint: {
      type: "string",
      desc: "Hermes endpoint to use, defaults to https://hermes.pyth.network",
    },
    encoding: {
      type: "string",
      desc: "Encoding to use for the price feeds (hex or base64), defaults to hex",
      choices: ["hex", "base64"],
      default: "hex",
    },
    "chunk-size": {
      type: "number",
      desc: "Chunk size to use for the price feeds, defaults to 150",
      default: 150,
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
  const contract = DefaultStore.contracts[argv.contract];
  const privateKey = toPrivateKey(argv["private-key"]);
  const encoding = argv.encoding || "hex";

  priceFeedsMetadata = await client.getPriceFeeds();

  const priceFeedIds = priceFeedsMetadata.map((feed) => feed.id);
  console.log(`Fetched ${priceFeedIds.length} price feed IDs`);

  // We can adjust the chunk size based on the chain. Don't exceed 150 for now.
  // TODO: Add a check for the chain's block gas limit and adjust the chunk size accordingly.
  const chunkSize = argv.chunkSize;
  for (let i = 0; i < priceFeedIds.length; i += chunkSize) {
    console.log(
      `Processing chunk ${i / chunkSize + 1} of ${Math.ceil(
        priceFeedIds.length / chunkSize,
      )}`,
    );
    const chunk = priceFeedIds.slice(i, i + chunkSize);
    console.log(`length: ${chunk.length}`);
    const updates = await client.getLatestPriceUpdates(chunk, {
      parsed: false,
    });
    console.log(
      await contract.executeUpdatePriceFeed(
        privateKey,
        updates.binary.data.map((update) =>
          encoding === "hex"
            ? Buffer.from(update, "hex")
            : Buffer.from(update, "base64"),
        ),
      ),
    );
  }
}

main();
