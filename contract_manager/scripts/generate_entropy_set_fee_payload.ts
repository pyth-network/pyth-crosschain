/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable n/no-process-env */
/* eslint-disable turbo/no-undeclared-env-vars */

import fs from "node:fs";
import path from "node:path";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/core/chains";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import { findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --config <path/to/config.json>")
  .options({
    "config-path": {
      demandOption: true,
      desc: "Path to the config file",
      type: "string",
    },
    "ops-key-path": {
      demandOption: true,
      desc: "Path to the ops key file",
      type: "string",
    },
    "rpc-url": {
      default: process.env.SOLANA_RPC_URL,
      desc: "Solana RPC URL",
      type: "string",
    },
    vault: {
      default: "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj",
      desc: "Vault ID",
      type: "string",
    },
  });

async function main() {
  const {
    "config-path": configPath,
    "ops-key-path": opsKeyPath,
    vault: vaultId,
    "rpc-url": rpcUrl,
  } = await parser.argv;

  const resolvedConfigPath = path.resolve(configPath);
  const config = JSON.parse(fs.readFileSync(resolvedConfigPath, "utf8"));

  const updatePayloads: Buffer[] = [];
  for (const entry of config) {
    const chain = DefaultStore.getChainOrThrow(entry.chainName, EvmChain);
    const entropyContract = findEntropyContract(chain);
    const payload = await entropyContract.generateSetPythFeePayload(
      entry.feeInWei,
    );
    updatePayloads.push(payload);
  }

  const vault = DefaultStore.vaults[vaultId];

  if (!vault) {
    throw new Error(`Vault with ID '${vaultId}' does not exist.`);
  }

  const keypair = await loadHotWallet(opsKeyPath);
  vault.connect(keypair, rpcUrl ? () => rpcUrl : undefined);
  const _proposal = await vault.proposeWormholeMessage(updatePayloads);
}

main();
