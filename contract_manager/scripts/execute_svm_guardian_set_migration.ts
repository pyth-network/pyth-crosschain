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
  ComputeBudgetProgram,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { PrivateKey } from "../src/core/base";
import { toDeploymentType, toPrivateKey } from "../src/core/base";
import { executeVaa } from "../src/node/utils/executor";
import { loadHotWallet, MultisigProposal } from "../src/node/utils/governance";
import type {
  SvmMigrationTarget,
  SvmMigrationTargetState,
} from "./svm_guardian_set_migration";
import {
  describeChainState,
  getVaultOrThrow,
  isCoreBridgeMigrated,
  isReceiverMigrated,
  loadMigrationConfig,
  MIGRATION_OPTIONS,
  readMigrationTargetState,
  relayPriceUpdate,
  resolveMigrationTargets,
} from "./svm_guardian_set_migration";

const VAA_WAIT_SECONDS = 300;

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
    "price-feed-id": {
      // SOL/USD.
      default:
        "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
      desc: "Price feed to relay for the final check",
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
  const vaultAuthority = await vault.getEmitter(registry);
  const targets = resolveMigrationTargets(config, argv.chain, vaultAuthority);

  const wallet = await loadHotWallet(argv["ops-key-path"]);
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

  if (targets.some(target => target.chain.isRemote)) {
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
      `\n=== ${target.chain.getId()} (governed by ${target.signer.toBase58()})`,
    );
    console.log(await describeChainState(target));

    console.log(`post-migration price relay from ${argv["hermes-url"]}`);
    console.log(
      `  ${await relayPriceUpdate(target, wallet, {
        feedId: argv["price-feed-id"],
        token: argv["hermes-token"],
        url: argv["hermes-url"],
      })}`,
    );
  }
}

// Both instructions go in one transaction: until the close lands, the receiver trusts the Pyth
// Pro emitter while the Wormhole guardians still control the bridge.
async function closeGuardianSets(
  target: SvmMigrationTarget,
  state: SvmMigrationTargetState,
  senderPrivateKey: PrivateKey,
) {
  const chainId = target.chain.getId();
  if (!(await isReceiverMigrated(target, state))) {
    throw new Error(
      `${chainId}: the receiver does not accept the Pyth Pro data sources yet; the governance message has not been executed there`,
    );
  }
  // On a chain the vault reaches over wormhole, the governance message is verified against the
  // very sets being closed.
  if (!(await isCoreBridgeMigrated(target, state))) {
    throw new Error(
      `${chainId}: the core bridge is still running the pre-migration build; it has to be upgraded before any guardian set is closed`,
    );
  }

  const guardianSets = await target.wormhole.getGuardianSets();
  const migrated = guardianSets.find(
    (set) =>
      set.index === 0 &&
      set.keys.length === state.guardianSet.length &&
      set.keys.every((key, index) => key === state.guardianSet[index]),
  );
  const toClose = guardianSets.filter((set) => set !== migrated);
  if (migrated && toClose.length === 0) {
    console.log(`${chainId}: guardian set already migrated`);
    return;
  }

  const payer = target.chain.getKeypair(senderPrivateKey);
  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
  );
  for (const set of toClose) {
    transaction.add(
      target.wormhole.generateCloseGuardianSetInstruction(
        payer.publicKey,
        set.index,
      ),
    );
  }
  if (!migrated) {
    transaction.add(
      target.wormhole.generateInitializeInstruction(payer.publicKey),
    );
  }

  const signature = await sendAndConfirmTransaction(
    target.chain.getConnection(),
    transaction,
    [payer],
  );
  console.log(
    `${chainId}: closed guardian sets ${toClose
      .map((set) => set.index)
      .join(", ")}${migrated ? "" : " and re-initialized"} in ${signature}`,
  );
}

await main();
