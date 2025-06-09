import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/node/utils/store";
import { ENTROPY_DEFAULT_KEEPER } from "../src/core/contracts";
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
  const entries: {
    chain: string;
    contract: string;
    owner: string;
    provider: string;
    feeManager: string;
    balance: string;
    keeperBalance: string;
    seq: string;
    version: string;
  }[] = [];

  const keeperAddress =
    ENTROPY_DEFAULT_KEEPER[argv.testnet ? "testnet" : "mainnet"];
  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    try {
      const provider = await contract.getDefaultProvider();
      const w3 = contract.getChain().getWeb3();
      const balance = await w3.eth.getBalance(provider);
      const keeperBalance = await w3.eth.getBalance(keeperAddress);
      let version = "unknown";
      try {
        version = await contract.getVersion();
      } catch (e) {
        /* old deployments did not have this method */
      }
      const providerInfo = await contract.getProviderInfo(provider);
      const owner = await contract.getOwner();

      entries.push({
        chain: contract.getChain().getId(),
        contract: contract.address,
        owner,
        provider,
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
