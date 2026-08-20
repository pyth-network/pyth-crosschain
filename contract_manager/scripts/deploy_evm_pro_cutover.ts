/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Deploys the on-chain artifacts a Pyth Pro cutover needs, and nothing else.
 *
 * Per selected chain:
 *  1. a pro-compatible wormhole receiver, if the store does not already have one
 *  2. a fresh `PythUpgradable` implementation, which the `UpgradeContract` payload will name
 *
 * Nothing is proposed and no legacy proxy is touched, so a run here is invisible to consumers.
 * The propose phase reads these addresses back out of the cache file. The two phases are separate
 * because the payloads embed the deployed addresses: a half-finished deploy sweep must not turn
 * into a proposal that signers review as one artifact.
 *
 * Chains that fail preflight are skipped before any gas is spent. Use `--dry-run` to see the plan
 * without deploying.
 *
 * Usage: $0 --chain ethereum --std-output-dir ../target_chains/ethereum/contracts/out \
 *           --private-key <key> [--dry-run]
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { PrivateKey } from "../src/core/base";
import { toDeploymentType, toPrivateKey } from "../src/core/base";
import type { EvmChain } from "../src/core/chains";
import type { DeployWormholeReceiverContractsConfig } from "./common";
import {
  CHAIN_SELECTION_OPTIONS,
  COMMON_DEPLOY_OPTIONS,
  deployIfNotCached,
  getOrDeployWormholeContract,
  getSelectedChains,
} from "./common";
import type {
  ChainStatus,
  CutoverPreflight,
  ProDeploymentType,
} from "./pro_cutover";
import {
  CUTOVER_CACHE_FILE,
  checkProWormholeGuardianSet,
  IMPLEMENTATION_ARTIFACT,
  isProDeploymentType,
  preflightChains,
  statusOf,
  verifyImplementation,
} from "./pro_cutover";

/** EIP-170. An implementation above this cannot be deployed at all. */
const MAX_CONTRACT_SIZE_BYTES = 24_576;

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_pro_cutover.ts")
  .usage(
    "Deploys the wormhole receiver and PythUpgradable implementation a Pro cutover proposal needs.\n" +
      "Proposes nothing and does not touch any legacy proxy.\n" +
      `Uses a cache file (${CUTOVER_CACHE_FILE}) so a re-run only retries what failed.\n` +
      "Usage: $0 (--all-chains [--testnet] | --chain <chain>...) --std-output-dir <dir> --private-key <key>",
  )
  .options({
    ...CHAIN_SELECTION_OPTIONS,
    "deployment-type": {
      default: "pro-compatible-production",
      desc: "The pro-compatible deployment being cut over to",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Print the plan and exit without deploying anything. Does not need a private key",
      type: "boolean",
    },
    "gas-multiplier": COMMON_DEPLOY_OPTIONS["gas-multiplier"],
    "gas-price-multiplier": COMMON_DEPLOY_OPTIONS["gas-price-multiplier"],
    "private-key": {
      demandOption: false,
      desc: "Private key to sign the deployments with. Required unless --dry-run",
      type: "string",
    },
    "save-contract": COMMON_DEPLOY_OPTIONS["save-contract"],
    "std-output-dir": COMMON_DEPLOY_OPTIONS["std-output-dir"],
  });

/**
 * Measures the deployed bytecode of the implementation artifact.
 *
 * Called before the first chain, so a missing or stale `forge build` fails immediately rather than
 * midway through a sweep that has already spent gas.
 * @param {string} jsonOutputDir The Foundry output directory.
 * @returns The size of the deployed bytecode in bytes.
 * @throws {Error} if the artifact is missing or has no deployed bytecode.
 */
function implementationSizeBytes(jsonOutputDir: string): number {
  const artifactPath = path.join(
    jsonOutputDir,
    `${IMPLEMENTATION_ARTIFACT}.sol`,
    `${IMPLEMENTATION_ARTIFACT}.json`,
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    deployedBytecode?: string | { object?: string };
  };
  const bytecode = artifact.deployedBytecode;
  const hex = typeof bytecode === "string" ? bytecode : bytecode?.object;
  if (hex === undefined || hex.length === 0) {
    throw new Error(`${artifactPath} has no deployed bytecode.`);
  }
  return hex.replace("0x", "").length / 2;
}

type DeployedAddresses = {
  wormholeAddress: string;
  implementationAddress: string;
  implementationVersion: string;
};

/**
 * Deploys everything one chain needs for its cutover proposal.
 * @param {EvmChain} chain The chain to deploy on.
 * @param {DeployWormholeReceiverContractsConfig} config The deployment configuration.
 * @param {ProDeploymentType} deploymentType The Pro deployment being cut over to.
 * @returns The addresses the propose phase will embed in the payloads.
 * @throws {Error} if a deploy fails or a deployed contract fails its post-deploy check.
 */
async function deployForChain(
  chain: EvmChain,
  config: DeployWormholeReceiverContractsConfig,
  deploymentType: ProDeploymentType,
): Promise<DeployedAddresses> {
  const wormholeContract = await getOrDeployWormholeContract(
    chain,
    config,
    CUTOVER_CACHE_FILE,
  );

  // Also covers receivers that were already in the store: preflight checked them, but a re-run
  // hours later is cheap insurance against pointing the proxy at a verifier nobody can sign for.
  const mismatch = await checkProWormholeGuardianSet(
    wormholeContract,
    deploymentType,
  );
  if (mismatch !== undefined) throw new Error(mismatch);

  const implementationAddress = await deployIfNotCached(
    CUTOVER_CACHE_FILE,
    chain,
    config,
    IMPLEMENTATION_ARTIFACT,
    [],
  );
  const implementationVersion = await verifyImplementation(
    chain,
    implementationAddress,
  );

  return {
    implementationAddress,
    implementationVersion,
    wormholeAddress: wormholeContract.address,
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Statuses a chain can be in and still be worth deploying to. */
function isDeployable(status: ChainStatus): boolean {
  return status === "READY" || status === "NEEDS RECEIVER";
}

function printPlan(results: CutoverPreflight[]): void {
  const idWidth = Math.max(
    ...results.map((result) => result.chain.getId().length),
    5,
  );
  console.log(
    `\n${"chain".padEnd(idWidth)}  receiver    implementation  status`.toUpperCase(),
  );
  const receiverPlan = (result: CutoverPreflight): string => {
    if (!isDeployable(statusOf(result))) return "-";
    return result.proWormhole === undefined ? "deploy" : "reuse";
  };

  for (const result of results) {
    const status = statusOf(result);
    const receiver = receiverPlan(result);
    console.log(
      `${result.chain.getId().padEnd(idWidth)}  ` +
        `${receiver.padEnd(10)}  ` +
        `${(isDeployable(status) ? "deploy" : "-").padEnd(14)}  ` +
        status,
    );
  }

  for (const result of results) {
    if (result.blockers.length === 0 && result.warnings.length === 0) continue;
    console.log(`\n${result.chain.getId()} [${statusOf(result)}]`);
    for (const blocker of result.blockers) console.log(`  ✗ ${blocker}`);
    for (const warning of result.warnings) console.log(`  ! ${warning}`);
  }
}

async function main() {
  const argv = await parser.argv;

  const deploymentType = toDeploymentType(argv.deploymentType);
  if (!isProDeploymentType(deploymentType)) {
    throw new Error(
      `--deployment-type must be pro-compatible-production or pro-compatible-staging, got ${deploymentType}`,
    );
  }

  let privateKey: PrivateKey | undefined;
  if (argv.privateKey !== undefined) privateKey = toPrivateKey(argv.privateKey);
  if (!argv.dryRun && privateKey === undefined) {
    throw new Error("--private-key is required unless --dry-run is set");
  }

  const selectedChains = getSelectedChains(argv);

  // Before anything else, so a stale or missing build fails on the first line rather than after
  // half a sweep. 24067 bytes is the dual-verify-removed implementation (PR #3973).
  const sizeBytes = implementationSizeBytes(argv.stdOutputDir);
  console.log(
    `${IMPLEMENTATION_ARTIFACT} deployed size: ${sizeBytes} bytes (EIP-170 limit ${MAX_CONTRACT_SIZE_BYTES})`,
  );
  if (sizeBytes > MAX_CONTRACT_SIZE_BYTES) {
    throw new Error(
      `${IMPLEMENTATION_ARTIFACT} is ${sizeBytes - MAX_CONTRACT_SIZE_BYTES} bytes over the EIP-170 limit ` +
        `and cannot be deployed. Rebuild with 'forge build --sizes'.`,
    );
  }

  console.log(
    `\nPreflighting ${selectedChains.length} chain(s) against ${deploymentType}...`,
  );
  const results = await preflightChains(selectedChains, deploymentType);
  printPlan(results);

  const planned = results.filter((result) => isDeployable(statusOf(result)));
  const skipped = results.filter((result) => !isDeployable(statusOf(result)));
  console.log(
    `\n${planned.length} chain(s) to deploy on, ${skipped.length} skipped.`,
  );

  if (argv.dryRun) {
    console.log("\n--dry-run set, nothing deployed.");
    return;
  }
  if (planned.length === 0) return;
  if (privateKey === undefined) throw new Error("unreachable: no private key");

  const config: DeployWormholeReceiverContractsConfig = {
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    jsonOutputDir: argv.stdOutputDir,
    privateKey,
    saveContract: argv.saveContract,
    type: deploymentType,
  };

  // Sequential on purpose. Deploys spend real money and a failure has to be attributable to one
  // chain; a concurrent sweep interleaves logs and makes a partial failure hard to read.
  const deployed = new Map<string, DeployedAddresses>();
  const failures: { chain: string; error: string }[] = [];
  for (const result of planned) {
    const chainId = result.chain.getId();
    console.log(`\n=== ${chainId} ===`);
    try {
      deployed.set(
        chainId,
        await deployForChain(result.chain, config, deploymentType),
      );
    } catch (error) {
      const message = describeError(error);
      console.error(`✗ ${chainId}: ${message}`);
      failures.push({ chain: chainId, error: message });
    }
  }

  console.log("\nDeployed");
  for (const [chainId, addresses] of deployed) {
    console.log(
      `  ${chainId}: receiver ${addresses.wormholeAddress}, ` +
        `implementation ${addresses.implementationAddress} (v${addresses.implementationVersion})`,
    );
  }
  console.log(
    `\nAddresses are cached in ${CUTOVER_CACHE_FILE} for the propose phase.`,
  );

  if (failures.length > 0) {
    console.log(`\nFailed on ${failures.length} chain(s)`);
    for (const failure of failures) {
      console.log(`  ${failure.chain}: ${failure.error}`);
    }
    console.log("Re-run to retry; cached deployments are not repeated.");
    process.exit(1);
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
