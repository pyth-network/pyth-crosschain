import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, ENTROPY_DEFAULT_KEEPER, createStore } from "../src";
import Web3 from "web3";
import { COMMON_STORE_OPTIONS } from "./common";

interface EntryInfo {
  chain: string;
  contract: string;
  provider: string;
  feeManager: string;
  balance: string;
  keeperBalance: string;
  seq: string;
  version: string;
}

interface ArgV {
  testnet: boolean;
  "store-dir"?: string;
  _: (string | number)[];
  $0: string;
}

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 [--store-dir <store-dir>]")
  .options({
    testnet: {
      type: "boolean",
      default: false,
      desc: "Fetch testnet contract fees instead of mainnet",
    },
    ...COMMON_STORE_OPTIONS,
  });

async function main() {
  const argv = (await parser.argv) as ArgV;
  const store = createStore(argv["store-dir"]);
  const entries: EntryInfo[] = [];
  const keeperAddress =
    ENTROPY_DEFAULT_KEEPER[argv.testnet ? "testnet" : "mainnet"];

  for (const contract of Object.values(store.entropy_contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    try {
      const provider = await contract.getDefaultProvider();
      const chain = contract.getChain();
      const w3 = chain.getWeb3();
      const balance = await w3.eth.getBalance(provider);
      const keeperBalance = await w3.eth.getBalance(keeperAddress);
      let version = "unknown";
      try {
        version = await contract.getVersion();
      } catch (e) {
        /* old deployments did not have this method */
      }
      const providerInfo = await contract.getProviderInfo(provider);
      entries.push({
        chain: contract.getChain().getId(),
        contract: contract.address,
        provider: providerInfo.uri,
        feeManager: providerInfo.feeManager,
        balance: Web3.utils.fromWei(balance),
        keeperBalance: Web3.utils.fromWei(keeperBalance),
        seq: providerInfo.sequenceNumber,
        version,
      });
      console.log(`Fetched info for ${contract.getId()}`);
    } catch (e) {
      console.error(`Error fetching info for ${contract.getId()}`, e);
    }
  }
  console.table(entries);
}

main();
