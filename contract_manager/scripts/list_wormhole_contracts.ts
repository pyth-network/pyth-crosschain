/* eslint-disable no-console */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmWormholeContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .options({
    testnet: {
      type: "boolean",
      default: false,
      desc: "Fetch testnet contracts instead of mainnet",
    },
  });

async function main() {
  const argv = await parser.argv;
  const entries: {
    chain: string;
    contract: string;
    guardianSetIndex: number;
    chainId: number;
  }[] = [];
  for (const contract of Object.values(DefaultStore.wormhole_contracts)) {
    if (
      contract instanceof EvmWormholeContract &&
      contract.getChain().isMainnet() !== argv.testnet
    ) {
      try {
        const index = await contract.getCurrentGuardianSetIndex();
        const chainId = await contract.getChainId();
        entries.push({
          chain: contract.getChain().getId(),
          contract: contract.address,
          guardianSetIndex: index,
          chainId: chainId,
        });
        console.log(`Fetched contract for ${contract.getId()}`);
      } catch (error) {
        console.error(`Error fetching contract for ${contract.getId()}`, error);
      }
    }
  }
  console.table(entries);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
