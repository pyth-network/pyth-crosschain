import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, ENTROPY_DEFAULT_KEEPER } from "../src";
import Web3 from "web3";

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
  const entries = [];
  const keeperAddress =
    ENTROPY_DEFAULT_KEEPER[argv.testnet ? "testnet" : "mainnet"];
  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    try {
      const provider = await contract.getDefaultProvider();
      const w3 = new Web3(contract.getChain().getRpcUrl());
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
