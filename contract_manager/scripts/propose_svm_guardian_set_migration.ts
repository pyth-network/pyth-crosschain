/** biome-ignore-all lint/suspicious/noConsole: progress output of a CLI script */
/** biome-ignore-all lint/style/noProcessEnv: CLI script, the token is an ambient secret */
/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: not run as a turbo task */

/**
 * Builds the authority-gated half of the SVM Wormhole guardian set migration and proposes it to
 * the multisig. Run `execute_svm_guardian_set_migration.ts` once the multisig approves.
 *
 * Before proposing anything it prints the whole of the on-chain state the migration will act on,
 * and relays a price update from the Hermes that is live today — the baseline the execute
 * script's post-migration relay is read against.
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
  relayPriceUpdate,
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
      desc: "Print the state of every chain and run every check, but do not submit the proposal. The pre-flight price relay still sends a transaction",
      type: "boolean",
    },
    "hermes-token": {
      default: process.env.PYTH_API_KEY,
      desc: "Bearer token for the Hermes instance, if it needs one",
      type: "string",
    },
    "hermes-url": {
      default: "https://hermes.pyth.network",
      desc: "Hermes to pull the pre-flight price update from. Its updates have to be signed by the guardian set the chain's core bridge is on, so use https://hermes-beta.pyth.network on a chain that follows the Wormhole testnet guardians",
      type: "string",
    },
    "price-feed-id": {
      // SOL/USD.
      default:
        "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
      desc: "Price feed to relay for the pre-flight check",
      type: "string",
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

  const wallet = await loadHotWallet(argv["ops-key-path"]);
  const targets = resolveMigrationTargets(config, argv.chain, vaultAuthority);
  const localInstructions = [];
  const remotePayloads = [];
  for (const target of targets) {
    const chainId = target.chain.getId();
    console.log(`\n=== ${chainId} (governed by ${target.signer.toBase58()})`);
    console.log(await describeChainState(target));

    console.log(`pre-flight price relay from ${argv["hermes-url"]}`);
    try {
      console.log(
        `  ${await relayPriceUpdate(target, wallet, {
          feedId: argv["price-feed-id"],
          token: argv["hermes-token"],
          url: argv["hermes-url"],
        })}`,
      );
    } catch (error) {
      // Reported rather than fatal. A chain that cannot relay a price today is still worth
      // migrating — the migration may well be what fixes it — but the execute script's
      // post-migration relay has nothing to be read against unless this one is known to work.
      console.log(
        `  FAILED: ${error instanceof Error ? error.message : error}`,
      );
    }

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
    console.log("\nDry run, no proposal was submitted");
    return;
  }

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
