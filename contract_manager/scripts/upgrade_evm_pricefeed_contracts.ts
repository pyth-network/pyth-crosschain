import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, loadHotWallet, toPrivateKey, createStore } from "../src";
import { readFileSync } from "fs";

import {
  COMMON_UPGRADE_OPTIONS,
  getSelectedChains,
  makeCacheFunction,
  COMMON_STORE_OPTIONS,
} from "./common";

const CACHE_FILE = ".cache-upgrade-evm";
const runIfNotCached = makeCacheFunction(CACHE_FILE);

const parser = yargs(hideBin(process.argv))
  .usage(
    "Deploys a new PythUpgradable contract to a set of chains and creates a governance proposal for it.\n" +
      `Uses a cache file (${CACHE_FILE}) to avoid deploying contracts twice\n` +
      "Usage: $0 --chain <chain_1> --chain <chain_2> --private-key <private_key> --ops-key-path <ops_key_path> --std-output <std_output> [--store-dir <store-dir>]"
  )
  .options({
    ...COMMON_UPGRADE_OPTIONS,
    ...COMMON_STORE_OPTIONS,
  });

interface ArgV {
  chain?: string[];
  "private-key": string;
  "ops-key-path": string;
  "std-output": string;
  "store-dir"?: string;
  testnet: boolean;
  allChains: boolean;
  _: (string | number)[];
  $0: string;
}

async function main() {
  const argv = (await parser.argv) as ArgV;
  const store = createStore(argv["store-dir"]);
  const selectedChains = getSelectedChains(argv);

  const vault =
    store.vaults["mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"];

  console.log("Using cache file", CACHE_FILE);
  console.log(
    "Upgrading on chains",
    selectedChains.map((c) => c.getId())
  );

  const payloads: Buffer[] = [];
  for (const chain of selectedChains) {
    const artifact = JSON.parse(readFileSync(argv["std-output"], "utf8"));
    console.log("Deploying contract to", chain.getId());
    const address = await runIfNotCached(`deploy-${chain.getId()}`, () => {
      return chain.deploy(
        toPrivateKey(argv["private-key"]),
        artifact["abi"],
        artifact["bytecode"],
        []
      );
    });
    console.log(`Deployed contract at ${address} on ${chain.getId()}`);
    payloads.push(
      chain.generateGovernanceUpgradePayload(address.replace("0x", ""))
    );
  }

  console.log("Using vault at for proposal", vault.getId());
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet ", wallet.publicKey.toBase58());
  await vault.connect(wallet);
  const proposal = await vault.proposeWormholeMessage(payloads);
  console.log("Proposal address", proposal.address.toBase58());
}

main();
