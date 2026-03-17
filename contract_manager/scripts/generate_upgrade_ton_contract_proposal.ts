/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable unicorn/no-process-exit */
/* eslint-disable n/no-process-exit */
/* eslint-disable unicorn/prefer-top-level-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import fs from "node:fs";
import path from "node:path";

import { CHAINS, toChainName } from "@pythnetwork/xc-admin-common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { TonChain } from "../src/core/chains";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Upgrades the Pyth contract on TON and creates a governance proposal for it.\n" +
      "Usage: $0 --network <mainnet|testnet> --contract-address <address> --ops-key-path <ops_key_path>\n" +
      "Required environment variables:\n" +
      "  - ENV_TON_MAINNET_API_KEY: API key for TON mainnet\n" +
      "  - ENV_TON_TESTNET_API_KEY: API key for TON testnet",
  )
  .options({
    "contract-address": {
      demandOption: true,
      description: "Address of the contract to upgrade",
      type: "string",
    },
    network: {
      choices: ["mainnet", "testnet"],
      demandOption: true,
      description: "Network to deploy to",
      type: "string",
    },
    "ops-key-path": {
      demandOption: true,
      description: "Path to operations key file",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;
  const isMainnet = argv.network === "mainnet";

  // Get chain ID and name from CHAINS mapping
  const chainId = isMainnet ? CHAINS.ton_mainnet : CHAINS.ton_testnet;
  const _wormholeChainName = toChainName(chainId);

  // Get the TON chain instance from DefaultStore based on network
  const chain = DefaultStore.getChainOrThrow(
    isMainnet ? "ton_mainnet" : "ton_testnet",
    TonChain,
  );

  const vault =
    DefaultStore.vaults[
      "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
    ];

  // Read the compiled contract from the build directory
  // NOTE: Remember to rebuild contract_manager before running this script because it will also build the ton contract
  const compiledPath = path.resolve(
    "../../target_chains/ton/contracts/build/Main.compiled.json",
  );
  const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf8"));
  const newCodeHash = compiled.hash;

  // Generate governance payload for the upgrade
  const payload = chain.generateGovernanceUpgradePayload(newCodeHash);
  const keypair = await loadHotWallet(argv["ops-key-path"]);
  vault?.connect(keypair);
  const _proposal = await vault?.proposeWormholeMessage([payload]);
}

main().catch((error) => {
  process.exit(1);
});
