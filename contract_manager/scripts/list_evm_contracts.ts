/* eslint-disable no-console */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmPriceFeedContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .options({
    testnet: {
      default: false,
      desc: "Fetch testnet contract fees instead of mainnet",
      type: "boolean",
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
      } catch (_error) {
        // Intentionally empty
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
