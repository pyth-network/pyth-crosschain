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

import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --config <path/to/config.json>")
  .options({
    "config-path": {
      type: "string",
      demandOption: true,
      desc: "Path to the config file",
    },
    "ops-key-path": {
      type: "string",
      demandOption: true,
      desc: "Path to the ops key file",
    },
    vault: {
      type: "string",
      default: "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj",
      desc: "Vault ID",
    },
    "rpc-url": {
      type: "string",
      desc: "Solana RPC URL",
      default: process.env.SOLANA_RPC_URL,
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
  for (const setFeeEntry of config) {
    const chain = DefaultStore.getChainOrThrow(setFeeEntry.chainName);
    const payload = chain.generateGovernanceSetFeePayload(
      setFeeEntry.fee,
      setFeeEntry.exponent,
    );
    updatePayloads.push(payload);
    console.log(
      `Generated payload for chain ${setFeeEntry.chainName}:`,
      payload.toString("hex"),
    );
  }

  const vault = DefaultStore.vaults[vaultId];

  if (!vault) {
    throw new Error(`Vault with ID '${vaultId}' does not exist.`);
  }

  const keypair = await loadHotWallet(opsKeyPath);
  vault.connect(keypair, rpcUrl ? () => rpcUrl : undefined);
  const proposal = await vault.proposeWormholeMessage(updatePayloads);
  console.log("Proposal address:", proposal.address.toBase58());
}

main();
