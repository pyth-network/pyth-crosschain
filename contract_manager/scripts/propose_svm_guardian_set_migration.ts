/** biome-ignore-all lint/suspicious/noConsole: progress output of a CLI script */

/**
 * Builds the authority-gated half of the SVM Wormhole guardian set migration and proposes it to
 * the multisig. Run `execute_svm_guardian_set_migration.ts` once the multisig approves.
 *
 * Usage:
 *   pnpm exec tsx scripts/propose_svm_guardian_set_migration.ts \
 *     --config-path ./migration.json --ops-key-path ~/.config/solana/id.json --dry-run
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toDeploymentType } from "../src/core/base";
import { loadHotWallet } from "../src/node/utils/governance";
import {
  buildMigrationInstructions,
  checkAuthorities,
  checkUpgradeBuffer,
  describeChainState,
  getVaultOrThrow,
  loadMigrationConfig,
  MIGRATION_OPTIONS,
  readMigrationTargetState,
  resolveMigrationTargets,
} from "./svm_guardian_set_migration";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Proposes the SVM Wormhole guardian set migration to the multisig.\n" +
      "Usage: $0 --config-path <path> --ops-key-path <path> [--chain <id>..] [--dry-run]",
  )
  .options({
    ...MIGRATION_OPTIONS,
    "dry-run": {
      default: false,
      desc: "Print the state of every chain and run every check, but do not submit anything",
      type: "boolean",
    },
  });

async function main() {
  const argv = await parser.argv;
  const config = loadMigrationConfig(argv["config-path"]);
  const state = readMigrationTargetState(
    config,
    toDeploymentType(argv["deployment-type"]),
  );
  const rpcUrl = argv["rpc-url"];
  const registry = rpcUrl ? () => rpcUrl : undefined;

  const vault = getVaultOrThrow(argv.vault);
  const vaultAuthority = await vault.getEmitter(registry);
  console.log(
    `Proposing to vault ${vault.getId()}, whose authority is ${vaultAuthority.toBase58()}`,
  );

  const targets = resolveMigrationTargets(config, argv.chain, vaultAuthority);
  const localInstructions = [];
  const remotePayloads = [];
  for (const target of targets) {
    const chainId = target.chain.getId();
    console.log(`\n=== ${chainId} (governed by ${target.signer.toBase58()})`);
    console.log(await describeChainState(target));

    await checkAuthorities(target);
    await checkUpgradeBuffer(target, state);

    const instructions = buildMigrationInstructions(target, state);
    if (target.chain.isRemote) {
      remotePayloads.push(
        target.chain.generateExecutePostedVaaPayload(instructions),
      );
    } else {
      localInstructions.push(...instructions);
    }
  }

  if (argv["dry-run"]) {
    console.log("\nDry run, nothing was submitted");
    return;
  }

  const wallet = await loadHotWallet(argv["ops-key-path"]);
  vault.connect(wallet, registry);

  // Chains the vault lives on and chains it reaches over wormhole need different kinds of
  // multisig instruction, so they cannot share a proposal.
  if (localInstructions.length > 0) {
    const proposals = await vault.proposeInstructions(localInstructions);
    for (const proposal of proposals) {
      console.log(`Local proposal address: ${proposal.address.toBase58()}`);
    }
  }
  if (remotePayloads.length > 0) {
    const proposal = await vault.proposeWormholeMessage(remotePayloads);
    console.log(`Remote proposal address: ${proposal.address.toBase58()}`);
  }
}

await main();
