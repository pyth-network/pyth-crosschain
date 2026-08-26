/** biome-ignore-all lint/suspicious/noConsole: progress output of a CLI script */
/** biome-ignore-all lint/style/noProcessEnv: CLI script, the token is an ambient secret */
/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: not run as a turbo task */

import type { Wallet } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { toDeploymentType, toPrivateKey } from "../src/core/base";
import { loadHotWallet } from "../src/node/utils/governance";
import type {
  SvmMigrationTarget,
  SvmMigrationTargetState,
} from "./svm_guardian_set_migration";
import {
  closeGuardianSets,
  describeChainState,
  loadMigrationConfig,
  MIGRATION_OPTIONS,
  readMigrationTargetState,
  relayPriceUpdate,
  resolveMigrationTargets,
} from "./svm_guardian_set_migration";

const SOL_USD_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

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
  });

async function main() {
  const argv = await parser.argv;
  const config = loadMigrationConfig(argv["config-path"]);
  const state = readMigrationTargetState(
    config,
    toDeploymentType(argv["deployment-type"]),
  );

  const wallet = loadHotWallet(argv["ops-key-path"]);
  const targets = resolveMigrationTargets(config, argv.chain, wallet.publicKey);

  // The raw key, so the relayed steps can sign on whichever chain they target rather than on the
  // vault's cluster.
  const senderPrivateKey = toPrivateKey(
    Buffer.from(wallet.payer.secretKey.subarray(0, 32)).toString("hex"),
  );

  for (const target of targets) {
    await setDataSourcesAndFee(target, state, wallet);
    await closeGuardianSets(target, state, senderPrivateKey);
  }
  for (const target of targets) {
    console.log(`\n=== ${target.chain.getId()}`);
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

async function setDataSourcesAndFee(
  target: SvmMigrationTarget,
  state: SvmMigrationTargetState,
  wallet: Wallet,
) {
  const instructions = [
    await target.receiver.generateSetDataSourcesInstruction(
      wallet.publicKey,
      state.dataSources,
    ),
    await target.receiver.generateSetFeeInstruction(
      wallet.publicKey,
      state.singleUpdateFeeInLamports,
    ),
  ];

  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
  );
  for (const instruction of instructions) {
    transaction.add(instruction);
  }

  const signature = await sendAndConfirmTransaction(
    target.chain.getConnection(),
    transaction,
    [wallet.payer],
  );
  console.log(
    `${target.chain.getId()}: set data sources and fee in ${signature}`,
  );
}

await main();
