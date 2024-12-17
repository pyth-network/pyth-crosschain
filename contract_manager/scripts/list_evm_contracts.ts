import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, EvmPriceFeedContract } from "../src";
import { createStore } from "../src";
import { COMMON_STORE_OPTIONS } from "./common";

interface ArgV {
  testnet: boolean;
  "store-dir"?: string;
}

interface ContractEntry {
  chain: string;
  contract: string;
  version: string;
}

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 [--store-dir <store-dir>]")
  .options({
    ...COMMON_STORE_OPTIONS,
    testnet: {
      type: "boolean",
      default: false,
      desc: "Fetch testnet contract fees instead of mainnet",
    },
  });

async function main() {
  const argv = (await parser.argv) as ArgV;
  const store = createStore(argv["store-dir"]);
  const entries: ContractEntry[] = [];
  for (const contract of Object.values(store.contracts)) {
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
