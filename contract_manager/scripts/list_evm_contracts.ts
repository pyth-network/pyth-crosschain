import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/node/utils/store";
import { EvmPriceFeedContract } from "../src/core/contracts";

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
  const entries: {
    chain: string;
    contract: string;
    version: string;
  }[] = [];
  for (const contract of Object.values(DefaultStore.contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    if (contract instanceof EvmPriceFeedContract) {
      try {
        const version = await contract.getVersion();
        entries.push({
          chain: contract.getChain().getId(),
          contract: contract.address,
          version: version,
        });
        console.log(`Fetched version for ${contract.getId()}`);
      } catch (e) {
        console.error(`Error fetching version for ${contract.getId()}`, e);
      }
    }
  }
  console.table(entries);
}

main();
