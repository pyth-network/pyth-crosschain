import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, loadHotWallet } from "../src";
import { readFileSync } from "fs";
import { parse } from "yaml";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --config <path/to/config.yaml>")
  .options({
    config: {
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
  });

async function main() {
  const {
    config,
    "ops-key-path": ops_key_path,
    vault: vault_id,
  } = await parser.argv;

  const config_obj = parse(readFileSync(config, "utf8"));

  let update_payloads: Buffer[] = [];
  for (const chain of config_obj) {
    const chain_obj = DefaultStore.chains[chain.name];
    if (!chain_obj) {
      throw new Error(`Chain with ID '${chain.name}' does not exist.`);
    }

    const payload = chain_obj.generateGovernanceSetFeePayload(
      chain.fee,
      chain.exponent
    );
    update_payloads.push(payload);
    console.log(
      `Generated payload for chain ${chain.name}:`,
      payload.toString("hex")
    );
  }

  const vault = DefaultStore.vaults[vault_id];

  if (!vault) {
    throw new Error(`Vault with ID '${vault_id}' does not exist.`);
  }

  const keypair = await loadHotWallet(ops_key_path);
  vault.connect(keypair);
  const proposal = await vault.proposeWormholeMessage(update_payloads);
  console.log("Proposal address:", proposal.address.toBase58());
}

main();
