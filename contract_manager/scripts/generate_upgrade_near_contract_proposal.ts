/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable unicorn/no-process-exit */
/* eslint-disable n/no-process-exit */
/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable no-console */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { NearChain } from "../src/core/chains";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Creates a governance proposal to upgrade the price feeds contract on Near.\n" +
      "Usage: $0 --network <mainnet|testnet> --code-hash <hash> --ops-key-path <ops_key_path>\n",
  )
  .options({
    "code-hash": {
      demandOption: true,
      description: "Sha-256 HEX of the wasm file",
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

  // Near wormhole contracts have the same id on testnet and mainnet.
  const chain = DefaultStore.getChainOrThrow("near", NearChain);

  const vault =
    DefaultStore.vaults[
      argv.network === "mainnet"
        ? "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
        : "devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3"
    ];

  const codeHash = argv["code-hash"];
  if (Buffer.from(codeHash, "hex").length != 32) {
    throw new Error("invalid code hash format");
  }

  // Generate governance payload for the upgrade
  const payload = chain.generateGovernanceUpgradePayload(codeHash);
  const keypair = await loadHotWallet(argv["ops-key-path"]);
  vault?.connect(keypair);
  const _proposal = await vault?.proposeWormholeMessage([payload]);
}

main().catch((error) => {
  process.exit(1);
});
