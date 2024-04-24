import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src";
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

const KEEPER_ADDRESS = {
  mainnet: "0xBcAb779fCa45290288C35F5E231c37F9fA87b130",
  testnet: "0xa5A68ed167431Afe739846A22597786ba2da85df",
};

async function main() {
  const argv = await parser.argv;
  const entries: unknown[] = [];
  const keeperAddress = KEEPER_ADDRESS[argv.testnet ? "testnet" : "mainnet"];
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
        balance,
        keeperBalance,
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
