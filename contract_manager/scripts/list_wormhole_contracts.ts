import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/node/utils/store";
import { EvmWormholeContract } from "../src/core/contracts";

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
      } catch (e) {
        console.error(`Error fetching contract for ${contract.getId()}`, e);
      }
    }
  }
  console.table(entries);
}

main();
