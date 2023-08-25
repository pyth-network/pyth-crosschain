import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  AptosContract,
  CosmWasmContract,
  DefaultStore,
  EvmContract,
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
      contract instanceof AptosContract ||
      contract instanceof EvmContract ||
      contract instanceof CosmWasmContract
    ) {
      console.log(`${contract.getId()} ${await contract.getTotalFee()}`);
    }
  }
}

main();
