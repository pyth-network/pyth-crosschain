/** biome-ignore-all lint/suspicious/noConsole: CLI script */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-console */
import { readFileSync } from "node:fs";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { DeploymentType } from "../src/core/base";
import {
  getDefaultDeploymentConfig,
  toDeploymentType,
  toPrivateKey,
} from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { EvmPriceFeedContract } from "../src/core/contracts";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import {
  COMMON_UPGRADE_OPTIONS,
  getOrDeployWormholeContract,
  getSelectedChains,
  makeCacheFunction,
} from "./common";

const CACHE_FILE = ".cache-migrate-evm-pro";
const runIfNotCached = makeCacheFunction(CACHE_FILE);

const MAINNET_VAULT_ID =
  "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj";
const DEVNET_VAULT_ID =
  "devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3";

/**
 * Finds the legacy (stable/beta / unset) price feed proxy for a chain.
 * Pro-compatible side-by-side deployments are skipped.
 */
function findLegacyPriceFeedContract(
  chain: EvmChain,
): EvmPriceFeedContract | undefined {
  for (const contract of Object.values(DefaultStore.contracts)) {
    if (!(contract instanceof EvmPriceFeedContract)) continue;
    if (contract.getChain().getId() !== chain.getId()) continue;
    if (
      contract.deploymentType === undefined ||
      contract.deploymentType === "stable" ||
      contract.deploymentType === "beta"
    ) {
      return contract;
    }
  }
  return undefined;
}

const parser = yargs(hideBin(process.argv))
  .usage(
    "Migrates legacy EVM Pyth price feed proxies in place to pro-compatible " +
      "wormhole + data sources.\n" +
      "Per chain: resolve/deploy pro wormhole, deploy new PythUpgradable impl, " +
      "then propose UpgradeContract + SetWormholeAddressAndDataSources " +
      "(fee 0/0) for the legacy proxy.\n" +
      `Uses a cache file (${CACHE_FILE}) to avoid deploying contracts twice.\n` +
      "Usage: $0 --chain <chain_1> --chain <chain_2> --private-key <private_key> " +
      "--ops-key-path <ops_key_path> --std-output <pyth_upgradable.json> " +
      "--std-output-dir <forge_out_dir> [--deployment-type pro-compatible-production] [--dry-run]",
  )
  .options({
    ...COMMON_UPGRADE_OPTIONS,
    "deployment-type": {
      choices: ["pro-compatible-production", "pro-compatible-staging"] as const,
      default: "pro-compatible-production" as const,
      demandOption: false,
      desc: "Pro-compatible deployment config for wormhole guardians and data sources",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Deploy contracts and build payloads but do not submit the vault proposal",
      type: "boolean",
    },
    "std-output": {
      demandOption: true,
      desc: "Path to the standard JSON output of the PythUpgradable contract (forge artifact)",
      type: "string",
    },
    "std-output-dir": {
      demandOption: true,
      desc: "Path to the Foundry output directory used to deploy/reuse the pro-compatible wormhole receiver",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;
  const selectedChains = getSelectedChains(argv);
  const deploymentType = toDeploymentType(
    argv["deployment-type"],
  ) as DeploymentType;
  const { dataSources: proDataSources } =
    getDefaultDeploymentConfig(deploymentType);
  const dryRun = argv["dry-run"];

  const isMainnet = selectedChains[0]?.isMainnet() ?? false;
  const vault =
    DefaultStore.vaults[isMainnet ? MAINNET_VAULT_ID : DEVNET_VAULT_ID];

  console.log("Using cache file", CACHE_FILE);
  console.log("Deployment type", deploymentType);
  console.log(
    "Migrating legacy proxies on chains",
    selectedChains.map((c) => c.getId()),
  );
  if (dryRun) {
    console.log("Dry run enabled — will not propose governance");
  }

  const wormholeDeployConfig = {
    gasMultiplier: 2,
    gasPriceMultiplier: 1,
    jsonOutputDir: argv["std-output-dir"],
    privateKey: toPrivateKey(argv["private-key"]),
    saveContract: true,
    type: deploymentType,
  };

  const payloads: Buffer[] = [];
  for (const chain of selectedChains) {
    const legacyContract = findLegacyPriceFeedContract(chain);
    if (!legacyContract) {
      console.warn(
        `No legacy price feed contract found in store for ${chain.getId()}; ` +
          `continuing (governance targets chain wormhole name ${chain.wormholeChainName})`,
      );
    } else {
      console.log(
        `Legacy proxy on ${chain.getId()}: ${legacyContract.address}`,
      );
    }

    console.log(`Resolving/deploying pro-compatible wormhole on ${chain.getId()}...`);
    const proWormhole = await getOrDeployWormholeContract(
      chain,
      wormholeDeployConfig,
      CACHE_FILE,
    );
    console.log(
      `Pro wormhole on ${chain.getId()}: ${proWormhole.address} (${proWormhole.deploymentType ?? "unknown"})`,
    );

    const artifact = JSON.parse(readFileSync(argv["std-output"], "utf8"));
    console.log(`Deploying PythUpgradable implementation to ${chain.getId()}...`);
    const implAddress = await runIfNotCached(
      `deploy-impl-${chain.getId()}-${deploymentType}`,
      () => {
        return chain.deploy(
          toPrivateKey(argv["private-key"]),
          artifact.abi,
          artifact.bytecode.object,
          [],
        );
      },
    );
    console.log(
      `Deployed PythUpgradable impl at ${implAddress} on ${chain.getId()}`,
    );

    // Order matters: UpgradeContract must execute before migrate (action 10).
    payloads.push(
      chain.generateGovernanceUpgradePayload(implAddress.replace("0x", "")),
    );
    payloads.push(
      chain.generateGovernanceSetWormholeAddressAndDataSourcesPayload(
        proWormhole.address.replace("0x", ""),
        proDataSources,
        0n,
        0n,
      ),
    );
    console.log(
      `Queued UpgradeContract + SetWormholeAddressAndDataSources for ${chain.getId()}`,
    );
  }

  console.log(`Built ${payloads.length} governance payloads (${payloads.length / 2} chains × 2)`);
  console.log("Using vault", vault?.getId());

  if (dryRun) {
    console.log("Dry run complete — skipping proposeWormholeMessage");
    for (const [i, payload] of payloads.entries()) {
      console.log(`  payload[${i}] hex length=${payload.toString("hex").length / 2} bytes`);
    }
    return;
  }

  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet", wallet.publicKey.toBase58());
  await vault?.connect(wallet);
  const proposal = await vault?.proposeWormholeMessage(payloads);
  console.log("Proposal address", proposal?.address.toBase58());
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
