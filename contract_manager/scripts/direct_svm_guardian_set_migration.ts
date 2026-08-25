/** biome-ignore-all lint/suspicious/noConsole: progress output of a CLI script */
/** biome-ignore-all lint/style/noProcessEnv: CLI script, the token is an ambient secret */
/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: not run as a turbo task */

import {
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { PrivateKey } from "../src/core/base";
import { toDeploymentType, toPrivateKey } from "../src/core/base";
import { loadHotWallet } from "../src/node/utils/governance";
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
import type { Wallet } from "@coral-xyz/anchor";

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
    "dry-run": {
      default: false,
      desc: "Do not execute the transactions, just simulate them",
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
  const dryRun = argv["dry-run"];


  const wallet = loadHotWallet(argv["ops-key-path"]);
  const targets = resolveMigrationTargets(config, argv.chain, wallet.publicKey);

  // The raw key, so the relayed steps can sign on whichever chain they target rather than on the
  // vault's cluster.
  const senderPrivateKey = toPrivateKey(
    Buffer.from(wallet.payer.secretKey.subarray(0, 32)).toString("hex"),
  );

  for (const target of targets) {
    await setDataSourcesAndFee(target, state, wallet, dryRun);
    await closeGuardianSets(target, state, senderPrivateKey, dryRun);
  }
  for (const target of targets) {
    console.log(
      `\n=== ${target.chain.getId()} (governed by ${target.signer.toBase58()})`,
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

async function setDataSourcesAndFee(target: SvmMigrationTarget, state: SvmMigrationTargetState, wallet: Wallet, dryRun: boolean) {
  const instructions = [
    await target.receiver.generateSetDataSourcesInstruction(wallet.publicKey, state.dataSources),
    await target.receiver.generateSetFeeInstruction(wallet.publicKey, state.singleUpdateFeeInLamports)
  ]

  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
  );
  for (const instruction of instructions) {
    transaction.add(instruction);
  }

  if (dryRun) {
    const simulationResult =  await target.chain.getConnection().simulateTransaction(transaction, [wallet.payer]);
    if (simulationResult.value.err) {
      throw new Error(`${target.chain.getId()}: set data sources and fee simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
    }
    else {
      console.log(`${target.chain.getId()}: set data sources and fee simulated`);
    }
  } else {
  // const signature = await sendAndConfirmTransaction(
  //   target.chain.getConnection(),
  //   transaction,
  //   [wallet.payer],
  // );
  // console.log(
  //   `${target.chain.getId()}: set data sources and fee in ${signature}`,
  // );
}
}

// Both instructions go in one transaction: until the close lands, the receiver trusts the Pyth
// Pro emitter while the Wormhole guardians still control the bridge.
async function closeGuardianSets(
  target: SvmMigrationTarget,
  state: SvmMigrationTargetState,
  senderPrivateKey: PrivateKey,
  dryRun: boolean,
) {
  const chainId = target.chain.getId();
  if (!(await isReceiverMigrated(target, state)) && !dryRun) {
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
  const toClose = guardianSets
    .filter((set) => set !== migrated)
    .sort((a, b) => b.index - a.index);
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

  if (dryRun) {
    const simulationResult = await target.chain.getConnection().simulateTransaction(transaction, [payer]);
    if (simulationResult.value.err) {
      throw new Error(`${chainId}: closed guardian sets simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
    }
    else {
      console.log(`${chainId}: closed guardian sets ${toClose
        .map((set) => set.index)
        .join(", ")}${migrated ? "" : " and re-initialized"} simulated`);
    }
  } else {
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
}

await main();
