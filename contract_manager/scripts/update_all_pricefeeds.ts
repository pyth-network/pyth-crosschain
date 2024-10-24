import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { HermesClient, PriceFeedMetadata } from "@pythnetwork/hermes-client";
import { DefaultStore, toPrivateKey } from "../src";

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
  });

// This script is intended to update all pricefeeds after we deploy pyth pricefeeds contract.
// It will fetch all pricefeeds from hermes and update the pricefeeds contract with the new pricefeeds.
async function main() {
  const argv = await parser.argv;
  let priceFeedsMetadata: PriceFeedMetadata[] = [];
  const client = new HermesClient(
    argv.endpoint || "https://hermes.pyth.network"
  );
  const contract = DefaultStore.contracts[argv.contract];
  const privateKey = toPrivateKey(argv["private-key"]);

  priceFeedsMetadata = await client.getPriceFeeds();

  const priceFeedIds = priceFeedsMetadata.map((feed) => feed.id);
  console.log(`Fetched ${priceFeedIds.length} price feed IDs`);

  // We can adjust the chunk size based on the chain. Don't exceed 150 for now.
  // TODO: Add a check for the chain's block gas limit and adjust the chunk size accordingly.
  const chunkSize = 150;
  for (let i = 0; i < priceFeedIds.length; i += chunkSize) {
    const chunk = priceFeedIds.slice(i, i + chunkSize);
    console.log(`length: ${chunk.length}`);
    const updates = await client.getLatestPriceUpdates(chunk, {
      parsed: false,
    });
    console.log(
      await contract.executeUpdatePriceFeed(
        privateKey,
        updates.binary.data.map((update) => Buffer.from(update, "hex"))
      )
    );
  }
}

main();
