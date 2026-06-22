/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { StellarLazerContract } from "../src/core/contracts";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --contract <id> --trusted-signer <hex33> --expires-at <ts>")
  .options({
    contract: {
      demandOption: true,
      desc: "Stellar Lazer contract id (e.g. stellar_testnet_C...)",
      type: "string",
    },
    "expires-at": {
      demandOption: true,
      desc: "Expiration timestamp (unix seconds) for the trusted signer; 0 removes it",
      type: "number",
    },
    "ops-key-path": {
      demandOption: true,
      desc: "Path to the ops key file",
      type: "string",
    },
    "trusted-signer": {
      demandOption: true,
      desc: "33-byte compressed secp256k1 signer key, hex without 0x",
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

  if (argv["expires-at"] !== 0 && argv["expires-at"] < Date.now() / 1000) {
    throw new Error(
      "Expiration timestamp must be in the future (or 0 to remove)",
    );
  }
  if (argv["trusted-signer"] === "") {
    throw new Error("Trusted signer key cannot be empty");
  }
  const vault = DefaultStore.vaults[argv.vault];
  if (!vault) {
    throw new Error(`Vault with ID '${argv.vault}' does not exist.`);
  }

  const contract = DefaultStore.lazer_contracts[argv.contract];
  if (!contract) {
    throw new Error(`Contract with ID '${argv.contract}' does not exist.`);
  }
  if (!(contract instanceof StellarLazerContract)) {
    throw new TypeError(
      `ID '${argv.contract}' is not a Stellar Lazer contract.`,
    );
  }

  console.log(`Generating payload for contract ${contract.getId()}`);
  const payload = contract.generateUpdateTrustedSignerPayload(
    argv["trusted-signer"],
    BigInt(argv["expires-at"]),
  );

  console.log("Using vault at for proposal", vault.getId());
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet", wallet.publicKey.toBase58());
  // eslint-disable-next-line @typescript-eslint/await-thenable, @typescript-eslint/no-confusing-void-expression
  await vault.connect(wallet);
  const proposal = await vault.proposeWormholeMessage([payload]);
  console.log("Proposal address", proposal.address.toBase58());
}

main();
