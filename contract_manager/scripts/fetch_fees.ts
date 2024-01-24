import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  AptosPriceFeedContract,
  CosmWasmPriceFeedContract,
  DefaultStore,
  EvmPriceFeedContract,
} from "../src";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .options({
    testnet: {
      type: "boolean",
      default: false,
      desc: "Fetch testnet contract fees instead of mainnet",
    },
  });

async function main() {
  const argv = await parser.argv;
  for (const contract of Object.values(DefaultStore.contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    if (
      contract instanceof AptosPriceFeedContract ||
      contract instanceof EvmPriceFeedContract ||
      contract instanceof CosmWasmPriceFeedContract
    ) {
      try {
        console.log(`${contract.getId()} ${await contract.getTotalFee()}`);
      } catch (e) {
        console.error(`Error fetching fees for ${contract.getId()}`, e);
      }
    }
  }
}

main();
