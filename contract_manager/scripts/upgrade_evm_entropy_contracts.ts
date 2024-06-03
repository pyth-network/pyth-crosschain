import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, loadHotWallet, toPrivateKey } from "../src";
import { readFileSync } from "fs";
import { PythCluster } from "@pythnetwork/client/lib/cluster";

import {
  COMMON_UPGRADE_OPTIONS,
  getSelectedChains,
  makeCacheFunction,
} from "./common";

const EXECUTOR_CACHE_FILE = ".cache-upgrade-evm-executor-contract";
const ENTROPY_CACHE_FILE = ".cache-upgrade-evm-entropy-contract";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Deploys a new Upgradeable contract for Executor or Entropy to a set of chains where Entropy is deployed and creates a governance proposal for it.\n" +
      `Uses a cache file to avoid deploying contracts twice\n` +
      "Usage: $0 --chain <chain_1> --chain <chain_2> --private-key <private_key> --ops-key-path <ops_key_path> --std-output <std_output>"
  )
  .options({
    ...COMMON_UPGRADE_OPTIONS,
    "contract-type": {
      type: "string",
      choices: ["executor", "entropy"],
      demandOption: true,
    },
  });

// Override these URLs to use a different RPC node for mainnet / testnet.
// TODO: extract these RPCs to a config file (?)
const RPCS: Record<string, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  testnet: "https://api.testnet.solana.com",
};
1;
function registry(cluster: PythCluster): string {
  return RPCS[cluster as string];
}

async function main() {
  const argv = await parser.argv;
  const cacheFile =
    argv["contract-type"] === "executor"
      ? EXECUTOR_CACHE_FILE
      : ENTROPY_CACHE_FILE;

  const runIfNotCached = makeCacheFunction(cacheFile);

  const selectedChains = getSelectedChains(argv);

  const vault =
    DefaultStore.vaults[
      "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
    ];

  console.log("Using cache file", cacheFile);

  // Try to deploy on every chain, then collect any failures at the end. This logic makes it simpler to
  // identify deployment problems (e.g., not enough gas) on every chain where they occur.
  const payloads: (Buffer | undefined)[] = [];
  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    if (selectedChains.includes(contract.chain)) {
      const artifact = JSON.parse(readFileSync(argv["std-output"], "utf8"));
      console.log("Deploying contract to", contract.chain.getId());
      try {
        const address = await runIfNotCached(
          `deploy-${contract.chain.getId()}`,
          () => {
            return contract.chain.deploy(
              toPrivateKey(argv["private-key"]),
              artifact["abi"],
              artifact["bytecode"],
              [],
              2
            );
          }
        );
        console.log(
          `Deployed contract at ${address} on ${contract.chain.getId()}`
        );
        const payload =
          argv["contract-type"] === "executor"
            ? await contract.generateUpgradeExecutorContractsPayload(address)
            : await contract.generateUpgradeEntropyContractPayload(address);

        console.log(payload.toString("hex"));
        payloads.push(payload);
      } catch (e) {
        console.log(`error deploying: ${e}`);
        payloads.push(undefined);
      }
    }
  }

  for (const payload of payloads) {
    if (payload == undefined) {
      throw new Error(
        "Some chains could not be deployed. Scroll up to see the errors from each chain."
      );
    }
  }

  console.log("Using vault at for proposal", vault.getId());
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet ", wallet.publicKey.toBase58());
  await vault.connect(wallet, registry);
  const proposal = await vault.proposeWormholeMessage(payloads as Buffer[]);
  console.log("Proposal address", proposal.address.toBase58());
}

main();
