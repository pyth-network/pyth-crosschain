/** biome-ignore-all lint/suspicious/noConsole: CLI script */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */

/**
 * In-place cutover of a legacy EVM Pyth proxy to Pro verification.
 *
 * Assumes singleUpdateFeeInWei is already 0 (set separately with
 * generate_governance_set_fee_payload.ts). This script does not change the
 * governance emitter or lastExecutedGovernanceSequence.
 *
 * Per chain it deploys a new PythUpgradable implementation (no new proxy) and
 * a Pro WormholeReceiver if missing, then proposes three existing governance
 * actions against the legacy proxy address:
 *
 *   [UpgradeContract]    → new PythUpgradable impl
 *   [SetDataSources]     → Pro price emitter(s)
 *   [SetWormholeAddress] → Pro WormholeReceiver
 *
 * Payload order in the vault proposal is VAA sequence order:
 *   [U₁, DS₁, WH₁, U₂, DS₂, WH₂, …]
 *
 * Execution must still be UpgradeContract first, then SetDataSources and
 * SetWormholeAddress in the same transaction per chain (see
 * execute_evm_cutover_vaas.ts). VAA₁ can be earlier than VAA₂+VAA₃.
 *
 * Usage: pnpm tsx scripts/migrate_evm_pricefeed_to_pro.ts \
 *   --chain <chain> --private-key <key> --ops-key-path <path> \
 *   --std-output-dir <foundry-out/> \
 *   --deployment-type pro-compatible-production|pro-compatible-staging
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { DeploymentType } from "../src/core/base";
import {
  getDefaultDeploymentConfig,
  toDeploymentType,
  toPrivateKey,
} from "../src/core/base";
import { loadHotWallet } from "../src/node/utils/governance";
import type { BaseDeployConfig } from "./common";
import {
  CHAIN_SELECTION_OPTIONS,
  COMMON_DEPLOY_OPTIONS,
  COMMON_UPGRADE_OPTIONS,
  deployIfNotCached,
  getOrDeployWormholeContract,
  getSelectedChains,
} from "./common";
import {
  findLegacyEvmPriceFeedContract,
  getOpsVault,
  governanceDataSourcesEqual,
  requireProCompatibleDeploymentType,
} from "./evm_pro_cutover";

const CACHE_FILE = ".cache-migrate-evm-to-pro";

type MigrateConfig = {
  saveContract: boolean;
  type: DeploymentType;
} & BaseDeployConfig;

const parser = yargs(hideBin(process.argv))
  .scriptName("migrate_evm_pricefeed_to_pro.ts")
  .usage(
    "Migrates legacy EVM Pyth proxies in place to Pro-compatible verification.\n" +
      `Uses a cache file (${CACHE_FILE}) to avoid deploying contracts twice.\n` +
      "Does not change the governance emitter. Assumes fee is already 0.\n" +
      "Usage: $0 --chain <chain> --private-key <private-key> --ops-key-path <ops-key-path> --std-output-dir <out/> --deployment-type <pro-compatible-production|pro-compatible-staging>",
  )
  .options({
    ...CHAIN_SELECTION_OPTIONS,
    "allow-nonzero-fee": {
      default: false,
      desc: "Allow migration when singleUpdateFeeInWei is not 0. Fee should normally be set to 0 first via generate_governance_set_fee_payload.ts",
      type: "boolean",
    },
    "deployment-type": {
      demandOption: true,
      desc: "Must be pro-compatible-production (mainnet) or pro-compatible-staging (testnet). stable/beta are refused",
      type: "string",
    },
    "gas-multiplier": COMMON_DEPLOY_OPTIONS["gas-multiplier"],
    "gas-price-multiplier": COMMON_DEPLOY_OPTIONS["gas-price-multiplier"],
    "ops-key-path": COMMON_UPGRADE_OPTIONS["ops-key-path"],
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    "save-contract": COMMON_DEPLOY_OPTIONS["save-contract"],
    "std-output-dir": COMMON_DEPLOY_OPTIONS["std-output-dir"],
    vault: {
      choices: ["mainnet", "devnet"] as const,
      desc: "Ops vault. Defaults to mainnet for mainnet chains and devnet for testnet chains",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;
  const selectedChains = getSelectedChains(argv);
  const deploymentType = toDeploymentType(argv.deploymentType);
  requireProCompatibleDeploymentType(deploymentType);

  const vaultChoice =
    argv.vault ?? (selectedChains[0]?.isMainnet() ? "mainnet" : "devnet");
  const vault = getOpsVault(vaultChoice);

  const config: MigrateConfig = {
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    jsonOutputDir: argv.stdOutputDir,
    privateKey: toPrivateKey(argv.privateKey),
    saveContract: argv.saveContract,
    type: deploymentType,
  };

  console.log("Using cache file", CACHE_FILE);
  console.log(
    "Migrating legacy proxies on chains",
    selectedChains.map((chain) => chain.getId()),
  );
  console.log("Deployment type", deploymentType);
  console.log("Using vault", vault.getId());

  const payloads: Buffer[] = [];
  const migrated: string[] = [];

  for (const chain of selectedChains) {
    const legacy = findLegacyEvmPriceFeedContract(chain);
    if (!legacy) {
      const message = `No legacy EvmPriceFeedContract (stable/beta/unlabeled) on ${chain.getId()} — already pro-compatible or missing`;
      if (argv.chain) {
        throw new Error(message);
      }
      console.log(`Skipping ${chain.getId()}: ${message}`);
      continue;
    }

    console.log(
      `\nMigrating ${chain.getId()} legacy proxy ${legacy.address} (deploymentType=${legacy.deploymentType ?? "unlabeled"})`,
    );

    const fee = await legacy.getBaseUpdateFee();
    if (BigInt(fee.amount) !== 0n && !argv.allowNonzeroFee) {
      throw new Error(
        `singleUpdateFeeInWei is ${fee.amount} on ${chain.getId()}; refuse to migrate unless fee is 0 (set via generate_governance_set_fee_payload.ts) or pass --allow-nonzero-fee`,
      );
    }
    if (BigInt(fee.amount) !== 0n) {
      console.log(
        `WARNING: singleUpdateFeeInWei is ${fee.amount} on ${chain.getId()}; continuing because --allow-nonzero-fee was set`,
      );
    }

    const expected = getDefaultDeploymentConfig(deploymentType);
    const onChainGovernance = await legacy.getGovernanceDataSource();
    if (
      !governanceDataSourcesEqual(
        onChainGovernance,
        expected.governanceDataSource,
      )
    ) {
      throw new Error(
        `On-chain governanceDataSource on ${chain.getId()} does not match ${deploymentType} config. This path cannot retarget governance. On-chain=${JSON.stringify(onChainGovernance)} expected=${JSON.stringify(expected.governanceDataSource)}`,
      );
    }

    const wormholeContract = await getOrDeployWormholeContract(
      chain,
      config,
      CACHE_FILE,
    );
    console.log(
      `Pro WormholeReceiver on ${chain.getId()}: ${wormholeContract.address} (deploymentType=${wormholeContract.deploymentType})`,
    );

    const newImpl = await deployIfNotCached(
      CACHE_FILE,
      chain,
      config,
      "PythUpgradable",
      [],
    );
    console.log(
      `PythUpgradable implementation on ${chain.getId()}: ${newImpl}`,
    );

    payloads.push(
      chain.generateGovernanceUpgradePayload(newImpl.replace("0x", "")),
    );
    payloads.push(chain.generateGovernanceSetDataSources(expected.dataSources));
    payloads.push(
      chain.generateGovernanceSetWormholeAddressPayload(
        wormholeContract.address.replace("0x", ""),
      ),
    );
    migrated.push(chain.getId());
  }

  if (payloads.length === 0) {
    throw new Error("No chains to migrate; no governance proposal created");
  }

  console.log(
    "\nPayload order is VAA sequence order: [UpgradeContract, SetDataSources, SetWormholeAddress] per chain.",
  );
  console.log(
    "Execute UpgradeContract first, then SetDataSources + SetWormholeAddress in the SAME transaction per chain (execute_evm_cutover_vaas.ts).",
  );
  console.log("Migrated chains:", migrated.join(", "));

  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet", wallet.publicKey.toBase58());
  vault.connect(wallet);
  const proposal = await vault.proposeWormholeMessage(payloads);
  console.log("Proposal address", proposal.address.toBase58());
}

main();
