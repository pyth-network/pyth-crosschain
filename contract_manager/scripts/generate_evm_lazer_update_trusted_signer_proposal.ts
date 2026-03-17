/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable no-console */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmLazerContract } from "../src/core/contracts";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --config <path/to/config.json>")
  .options({
    contract: {
      demandOption: true,
      desc: "Contract to update the trusted signer on. (e.g mumbai_0xff1a0f4744e8582DF1aE09D5611b887B6a12925C)",
      type: "string",
    },
    "expires-at": {
      demandOption: true,
      desc: "Expiration timestamp for the trusted signer",
      type: "number",
    },
    "ops-key-path": {
      demandOption: true,
      desc: "Path to the ops key file",
      type: "string",
    },
    "trusted-signer": {
      demandOption: true,
      desc: "Address of the trusted signer",
      type: "string",
    },
    vault: {
      default: "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj",
      desc: "Vault ID",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;

  if (argv["expires-at"] < Date.now() / 1000) {
    throw new Error("Expiration timestamp must be in the future");
  }
  if (argv["trusted-signer"] === "") {
    throw new Error("Trusted signer address cannot be empty");
  }
  const vault = DefaultStore.vaults[argv.vault];
  if (!vault) {
    throw new Error(`Vault with ID '${argv.vault}' does not exist.`);
  }

  const contract = DefaultStore.lazer_contracts[argv.contract];
  if (!contract) {
    throw new Error(`Contract with ID '${argv.contract}' does not exist.`);
  }
  if (!(contract instanceof EvmLazerContract)) {
    throw new TypeError(`ID '${argv.contract}' is not an EVM Lazer contract.`);
  }
  const updatePayloads: Buffer[] = [];
  const payload = await contract.generateUpdateTrustedSignerPayload(
    argv["trusted-signer"],
    argv["expires-at"],
  );
  updatePayloads.push(payload);
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  // eslint-disable-next-line @typescript-eslint/await-thenable, @typescript-eslint/no-confusing-void-expression
  await vault.connect(wallet);
  const _proposal = await vault.proposeWormholeMessage(updatePayloads);
}

main();
