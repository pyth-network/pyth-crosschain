import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, loadHotWallet, createStore } from "../src";
import { TonChain } from "../src/chains";
import { CHAINS, toChainName } from "@pythnetwork/xc-admin-common";
import fs from "fs";
import path from "path";
import { COMMON_STORE_OPTIONS } from "./common";

interface ArgV {
  network: "mainnet" | "testnet";
  "contract-address": string;
  "ops-key-path": string;
  "store-dir"?: string;
}

const parser = yargs(hideBin(process.argv))
  .usage(
    "Upgrades the Pyth contract on TON and creates a governance proposal for it.\n" +
      "Usage: $0 --network <mainnet|testnet> --contract-address <address> --ops-key-path <ops_key_path> [--store-dir <store-dir>]\n" +
      "Required environment variables:\n" +
      "  - ENV_TON_MAINNET_API_KEY: API key for TON mainnet\n" +
      "  - ENV_TON_TESTNET_API_KEY: API key for TON testnet"
  )
  .options({
    ...COMMON_STORE_OPTIONS,
    network: {
      type: "string",
      choices: ["mainnet", "testnet"],
      description: "Network to deploy to",
      demandOption: true,
    },
    "contract-address": {
      type: "string",
      description: "Address of the contract to upgrade",
      demandOption: true,
    },
    "ops-key-path": {
      type: "string",
      description: "Path to operations key file",
      demandOption: true,
    },
  });

async function main() {
  const argv = (await parser.argv) as ArgV;
  const store = createStore(argv["store-dir"]);
  const isMainnet = argv.network === "mainnet";

  // Get chain ID and name from CHAINS mapping
  const chainId = isMainnet ? CHAINS.ton_mainnet : CHAINS.ton_testnet;
  const wormholeChainName = toChainName(chainId);

  // Get the TON chain instance from store based on network
  const chain = store.chains[isMainnet ? "ton_mainnet" : "ton_testnet"];
  if (!chain || !(chain instanceof TonChain)) {
    throw new Error(`Chain configuration not found for TON ${argv.network}`);
  }

  const vault =
    store.vaults["mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"];

  console.log(
    `Upgrading contract on TON ${argv.network} (Chain ID: ${chainId}, Wormhole Chain Name: ${wormholeChainName})`
  );

  // Read the compiled contract from the build directory
  // NOTE: Remember to rebuild contract_manager before running this script because it will also build the ton contract
  const compiledPath = path.resolve(
    __dirname,
    "../../target_chains/ton/contracts/build/Main.compiled.json"
  );
  const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf8"));
  const newCodeHash = compiled.hash;
  console.log("New code hash:", newCodeHash);

  // Generate governance payload for the upgrade
  const payload = chain.generateGovernanceUpgradePayload(newCodeHash);
  console.log("Generated governance payload");
  console.log("Payload:", payload);

  // Create and submit governance proposal
  console.log("Using vault for proposal:", vault.getId());
  const keypair = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet:", keypair.publicKey.toBase58());
  vault.connect(keypair);
  const proposal = await vault.proposeWormholeMessage([payload]);
  console.log("Proposal address:", proposal.address.toBase58());
}

main().catch((error) => {
  console.error("Error during upgrade:", error);
  process.exit(1);
});
