/** biome-ignore-all lint/suspicious/noConsole: progress output of a CLI script */
/** biome-ignore-all lint/style/noProcessEnv: CLI script, the token is an ambient secret */
/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: not run as a turbo task */

/**
 * Builds the authority-gated half of the SVM Wormhole guardian set migration and proposes it to
 * the multisig. Run `execute_svm_guardian_set_migration.ts` once the multisig approves.
 */

import type { ProposedAction } from "@pythnetwork/xc-admin-common";
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
  relayPriceUpdate,
  resolveMigrationTargets,
} from "./svm_guardian_set_migration";

// Hermes instance and feed id go together: a feed id from one does not exist on the other.
const HERMES = {
  "pro-compatible-production": {
    solUsdFeedId:
      "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    url: "https://hermes.pyth.network",
  },
  "pro-compatible-staging": {
    solUsdFeedId:
      "0xfe650f0367d4a7ef9815a593ea15d36593f0643aaaf0149bb04be67ab851decd",
    url: "https://hermes-beta.pyth.network",
  },
};

const parser = yargs(hideBin(process.argv))
  .usage(
    "Proposes the SVM Wormhole guardian set migration to the multisig.\n" +
      "Usage: $0 --config-path <path> --ops-key-path <path> [--chain <id>..] [--dry-run]",
  )
  .options({
    ...MIGRATION_OPTIONS,
    "dry-run": {
      default: false,
      desc: "Print the state of every chain and run every check, but do not submit the proposal. The pre-flight price relay still sends a transaction",
      type: "boolean",
    }
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
  const hermes = HERMES[argv["deployment-type"]];

  const vault = getVaultOrThrow(argv.vault);
  const vaultAuthority = vault.getEmitter(registry);
  console.log(
    `Proposing to vault ${vault.getId()}, whose authority is ${vaultAuthority.toBase58()}`,
  );

  const wallet = loadHotWallet(argv["ops-key-path"]);
  const targets = resolveMigrationTargets(config, argv.chain, vaultAuthority);
  const actions: ProposedAction[] = [];
  for (const target of targets) {
    const chainId = target.chain.getId();
    console.log(`\n=== ${chainId} (governed by ${target.signer.toBase58()})`);
    console.log(await describeChainState(target));

    // A hard gate: without a pre-migration baseline the execute script's relay proves nothing.
    console.log(`pre-flight price relay from ${hermes.url}`);
    console.log(
      `  ${await relayPriceUpdate(target, wallet, {
        feedId: hermes.solUsdFeedId,
        token: undefined,
        url: hermes.url,
      })}`,
    );

    await checkAuthorities(target);
    await checkUpgradeBuffer(target, state);

    const { chain } = target;
    for (const instruction of await buildMigrationInstructions(target, state)) {
      actions.push(
        chain.isRemote
          ? { payload: chain.generateExecutePostedVaaPayload(instruction) }
          : { instruction },
      );
    }
  }

  if (argv["dry-run"]) {
    console.log("\nDry run, no proposal was submitted");
    return;
  }

  vault.connect(wallet, registry);

  const proposal = await vault.proposeActions(actions);
  console.log(`\nProposal address: ${proposal.address.toBase58()}`);
}

await main();
