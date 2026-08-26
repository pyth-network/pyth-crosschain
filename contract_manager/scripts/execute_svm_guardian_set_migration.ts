/** biome-ignore-all lint/suspicious/noConsole: progress output of a CLI script */
/** biome-ignore-all lint/style/noProcessEnv: CLI script, the token is an ambient secret */
/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: not run as a turbo task */

/**
 * Carries out the SVM Wormhole guardian set migration that
 * `propose_svm_guardian_set_migration.ts` proposed, once the multisig has approved it.
 *
 * Every step checks the on-chain state it is about to produce and skips itself if that state is
 * already there, so a run that fails part way through can simply be repeated.
 */

import {
  PublicKey,
} from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toDeploymentType, toPrivateKey } from "../src/core/base";
import { executeVaa } from "../src/node/utils/executor";
import { loadHotWallet, MultisigProposal } from "../src/node/utils/governance";
import {
  closeGuardianSets,
  describeChainState,
  getVaultOrThrow,
  loadMigrationConfig,
  MIGRATION_OPTIONS,
  readMigrationTargetState,
  relayPriceUpdate,
  resolveMigrationTargets,
} from "./svm_guardian_set_migration";

const VAA_WAIT_SECONDS = 300;
const SOL_USD_FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Executes the SVM Wormhole guardian set migration once the multisig has approved it.\n" +
      "Usage: $0 --config-path <path> --ops-key-path <path> --proposal <address>",
  )
  .options({
    ...MIGRATION_OPTIONS,
    "hermes-token": {
      default: process.env.PYTH_API_KEY,
      desc: "Bearer token for the Hermes instance",
      type: "string",
    },
    "hermes-url": {
      default: "https://pyth.dourolabs.app/hermes",
      desc: "Hermes instance to pull the price update for the final check from",
      type: "string",
    },
    proposal: {
      demandOption: true,
      desc: "Address of the proposal to execute. One that an earlier run already executed still has its governance messages relayed",
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
  const vaultAuthority = vault.getEmitter(registry);
  const targets = resolveMigrationTargets(config, argv.chain, vaultAuthority);

  const wallet = loadHotWallet(argv["ops-key-path"]);
  vault.connect(wallet, registry);
  // The raw key, so the relayed steps can sign on whichever chain they target rather than on the
  // vault's cluster.
  const senderPrivateKey = toPrivateKey(
    Buffer.from(wallet.payer.secretKey.subarray(0, 32)).toString("hex"),
  );

  const proposal = new MultisigProposal(
    new PublicKey(argv.proposal),
    vault.getSquadOrThrow(),
    vault.cluster,
  );
  console.log(
    `Executing proposal ${argv.proposal}, ${await proposal.getState()}`,
  );
  await proposal.execute();
  // Read off the proposal rather than off what this run executed, so a proposal an earlier run
  // already took through still has its messages relayed.
  const messages = await proposal.fetchEmittedWormholeMessages();

  if (targets.some((target) => target.chain.isRemote)) {
    for (const message of messages) {
      console.log(`Relaying governance message ${message.sequenceNumber}`);
      await executeVaa(
        senderPrivateKey,
        await message.fetchVaa(VAA_WAIT_SECONDS),
      );
    }
  }

  for (const target of targets) {
    await closeGuardianSets(target, state, senderPrivateKey);
  }
  for (const target of targets) {
    console.log(
      `\n=== ${target.chain.getId()}`,
    );
    console.log(await describeChainState(target));

    console.log(`post-migration price relay from ${argv["hermes-url"]}`);
    console.log(
      `  ${await relayPriceUpdate(target, wallet, {
        feedId: SOL_USD_FEED_ID,
        token: argv["hermes-token"],
        url: argv["hermes-url"],
      })}`,
    );
  }
}

await main();
