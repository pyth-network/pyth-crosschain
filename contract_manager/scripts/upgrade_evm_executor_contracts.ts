import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, loadHotWallet, toPrivateKey } from "../src";
import { readFileSync } from "fs";
import {
  COMMON_UPGRADE_OPTIONS,
  getSelectedChains,
  makeCacheFunction,
} from "./deploy_utils";

const CACHE_FILE = ".cache-upgrade-evm-executor-contract";
const runIfNotCached = makeCacheFunction(CACHE_FILE);

const parser = yargs(hideBin(process.argv))
  .usage(
    "Deploys a new ExecutorUpgradeable contract to a set of chains where Entropy is deployed and creates a governance proposal for it.\n" +
      `Uses a cache file (${CACHE_FILE}) to avoid deploying contracts twice\n` +
      "Usage: $0 --chain <chain_1> --chain <chain_2> --private-key <private_key> --ops-key-path <ops_key_path> --std-output <std_output>"
  )
  .options(COMMON_UPGRADE_OPTIONS);

async function main() {
  const argv = await parser.argv;
  const selectedChains = getSelectedChains(argv);

  const vault =
    DefaultStore.vaults[
      "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
    ];

  console.log("Using cache file", CACHE_FILE);

  const payloads: Buffer[] = [];
  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    if (selectedChains.includes(contract.chain)) {
      const artifact = JSON.parse(readFileSync(argv["std-output"], "utf8"));
      console.log("Deploying contract to", contract.chain.getId());
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
      const payload = await contract.generateUpgradeExecutorContractsPayload(
        address
      );
      console.log(payload.toString("hex"));
      payloads.push(payload);
    }
  }

  console.log("Using vault at for proposal", vault.getId());
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet ", wallet.publicKey.toBase58());
  await vault.connect(wallet);
  const proposal = await vault.proposeWormholeMessage(payloads);
  console.log("Proposal address", proposal.address.toBase58());
}

main();
