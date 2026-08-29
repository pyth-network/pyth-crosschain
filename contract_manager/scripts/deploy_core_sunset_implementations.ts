/* eslint-disable no-console */
/**
 * OP-PIP-128: deploy 1.4.6 PythUpgradable implementations (deploy ONLY, no
 * proposal) on the chains listed in the sunset config's `upgrade` section,
 * then write each deployed address back into the config's newImplementation
 * field for generate_core_sunset_proposal.ts to consume.
 *
 * - Uses a cache file so re-runs never double-deploy (same pattern as
 *   upgrade_evm_pricefeed_contracts.ts).
 * - Reads the private key from the env var named by --private-key-env
 *   (default: PK), or from a file via --private-key-path. Either way the key
 *   never appears in argv, shell history, or logs.
 * - Skips zksync-stack chains (zksync, abstract): their bytecode must come
 *   from the zksolc pipeline, not the forge artifact.
 *
 * Usage:
 *   export PK=<deployer_private_key>
 *   pnpm tsx scripts/deploy_core_sunset_implementations.ts \
 *     --config-path scripts/generate_core_sunset_config.json \
 *     --std-output ../target_chains/ethereum/contracts/out/PythUpgradable.sol/PythUpgradable.json \
 *     [--chain arbitrum --chain base]
 */
import fs from "node:fs";
import path from "node:path";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { DefaultStore } from "../src/node/utils/store";
import { makeCacheFunction } from "./common";

const CACHE_FILE = ".cache-core-sunset-deploy";
const ZK_STACK_CHAINS = new Set(["zksync", "abstract"]);

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --config-path <path> --std-output <path> --private-key-path <path> [--chain <id> ...]",
  )
  .options({
    chain: {
      desc: "Only deploy on these chain ids (default: all pending in config)",
      type: "array",
    },
    "config-path": {
      demandOption: true,
      desc: "Path to the sunset config JSON",
      type: "string",
    },
    "private-key-env": {
      default: "PK",
      desc: "Name of the env variable holding the deployer private key",
      type: "string",
    },
    "private-key-path": {
      desc: "Path to a file containing the deployer private key (overrides --private-key-env)",
      type: "string",
    },
    "std-output": {
      demandOption: true,
      desc: "Path to the forge PythUpgradable artifact JSON",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;
  const runIfNotCached = makeCacheFunction(CACHE_FILE);

  const configPath = path.resolve(argv["config-path"]);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    upgrade: { chainName: string; newImplementation: string | null }[];
    withdraw: unknown[];
  };
  const artifact = JSON.parse(fs.readFileSync(argv["std-output"], "utf8"));
  const rawKey = argv["private-key-path"]
    ? fs.readFileSync(path.resolve(argv["private-key-path"]), "utf8")
    : // eslint-disable-next-line n/no-process-env, turbo/no-undeclared-env-vars
      process.env[argv["private-key-env"]];
  if (!rawKey)
    throw new Error(
      `No private key: set env var ${argv["private-key-env"]} or pass --private-key-path`,
    );
  const privateKey = toPrivateKey(rawKey.trim().replace(/^0x/, ""));

  const only = argv.chain?.map(String);
  const pending = config.upgrade.filter(
    (u) =>
      !u.newImplementation &&
      (!only || only.includes(u.chainName)) &&
      !ZK_STACK_CHAINS.has(u.chainName),
  );
  const skippedZk = config.upgrade.filter(
    (u) => !u.newImplementation && ZK_STACK_CHAINS.has(u.chainName),
  );
  if (skippedZk.length > 0)
    console.warn(
      `Skipping zksync-stack chains (need zksolc pipeline): ${skippedZk.map((u) => u.chainName).join(", ")}`,
    );
  console.log(`Deploying on ${pending.length} chains, cache: ${CACHE_FILE}`);

  for (const entry of pending) {
    const chain = DefaultStore.getChainOrThrow(entry.chainName);
    if (!(chain instanceof EvmChain))
      throw new Error(`${entry.chainName} is not an EVM chain`);
    try {
      console.log(`deploying on ${entry.chainName}...`);
      const address: string = await runIfNotCached(
        `deploy-${entry.chainName}`,
        // 1.1x gas and 1.5x gas price: cheap insurance against base-fee
        // drift between estimation and send (bit us on arbitrum/ethereum).
        () =>
          chain.deploy(
            privateKey,
            artifact.abi,
            artifact.bytecode.object,
            [],
            1.1,
            1.5,
          ),
      );
      entry.newImplementation = address;
      console.log(`${entry.chainName}: ${address}`);
      // Persist after every deploy so a mid-run failure loses nothing.
      fs.writeFileSync(configPath, JSON.stringify(config, undefined, 2) + "\n");
    } catch (error) {
      console.error(`${entry.chainName}: FAILED - ${(error as Error).message}`);
    }
  }

  const remaining = config.upgrade.filter((u) => !u.newImplementation);
  console.log(
    remaining.length === 0
      ? "\nAll implementation addresses filled."
      : `\nStill pending: ${remaining.map((u) => u.chainName).join(", ")}`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
