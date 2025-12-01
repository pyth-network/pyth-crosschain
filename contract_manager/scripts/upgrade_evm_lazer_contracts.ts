/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
import { execSync } from "node:child_process";
import path from "node:path";

import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  COMMON_UPGRADE_OPTIONS,
  getSelectedChains,
  makeCacheFunction,
} from "./common";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const LAZER_CACHE_FILE = ".cache-upgrade-evm-lazer-contract";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Deploys a new PythLazer implementation contract to a set of chains and creates a governance proposal for upgrading the proxy.\n" +
      `Uses a cache file to avoid deploying contracts twice\n` +
      "Usage: $0 --chain <chain_1> --chain <chain_2> --private-key <private_key> --ops-key-path <ops_key_path>",
  )
  .options({
    ...COMMON_UPGRADE_OPTIONS,
  });

// Override these URLs to use a different RPC node for mainnet / testnet.
// TODO: extract these RPCs to a config file (?)
const RPCS = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  testnet: "https://api.testnet.solana.com",
  devnet: "https://api.devnet.solana.com",
} as Record<PythCluster, string>;

function registry(cluster: PythCluster): string {
  return RPCS[cluster];
}

type ForgeScriptOutput = {
  logs?: {
    level?: string;
    msg?: string;
  }[];
  returns?: Record<string, unknown>;
};

function deployLazerImplementation(
  chain: string,
  rpcUrl: string,
  privateKey: string,
): Promise<string> {
  const lazerContractsDir = path.resolve("../../lazer/contracts/evm");

  // Build forge command to deploy only the implementation with JSON output
  const forgeCommand = `forge script script/PythLazerDeploy.s.sol --rpc-url ${rpcUrl} --private-key ${privateKey} --broadcast --sig "deployImplementationForUpgrade()" --json`;

  try {
    console.log(`Deploying PythLazer implementation to ${chain}...`);
    const output = execSync(forgeCommand, {
      cwd: lazerContractsDir,
      encoding: "utf8",
      stdio: "pipe",
    });

    // Parse JSON output
    let jsonOutput: ForgeScriptOutput;
    try {
      // Forge may output multiple JSON objects (one per line) or a single JSON object
      // Try to parse as single JSON first, then as newline-delimited JSON
      const lines = output.trim().split("\n");
      const lastLine = lines.at(-1);
      if (!lastLine) {
        throw new Error("Empty output from forge script");
      }
      jsonOutput = JSON.parse(lastLine) as ForgeScriptOutput;
    } catch (parseError) {
      // If JSON parsing fails, fall back to regex parsing for error messages
      console.log("Deployment output (non-JSON):");
      console.log(output);
      const errorMessage =
        parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`Failed to parse forge script JSON output: ${errorMessage}`);
    }

    // Extract implementation address from console logs in JSON output
    // The deployImplementation function logs multiple possible formats:
    // - "Deployed implementation to: <address>"
    // - "Implementation already deployed at: <address>"
    // - "Implementation address for upgrade: <address>" (from deployImplementationForUpgrade)
    const addressPattern = /(0x[a-fA-F0-9]{40})/;

    if (jsonOutput.logs) {
      for (const log of jsonOutput.logs) {
        const msg = log.msg ?? "";
        if (
          msg.includes("Deployed implementation to:") ||
          msg.includes("Implementation already deployed at:") ||
          msg.includes("Implementation address for upgrade:")
        ) {
          const match = addressPattern.exec(msg);
          const implAddress = match?.[1];
          if (implAddress) {
            console.log(`\nPythLazer implementation address: ${implAddress}`);
            return Promise.resolve(implAddress);
          }
        }
      }
    }

    // Fallback: try to extract from raw output if logs structure is different
    console.log("Deployment output:");
    console.log(output);
    const patterns = [
      /Deployed implementation to: (0x[a-fA-F0-9]{40})/,
      /Implementation already deployed at: (0x[a-fA-F0-9]{40})/,
      /Implementation address for upgrade: (0x[a-fA-F0-9]{40})/,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(output);
      const implAddress = match?.[1];
      if (implAddress) {
        console.log(`\nPythLazer implementation address: ${implAddress}`);
        return Promise.resolve(implAddress);
      }
    }

    throw new Error(
      "Could not extract implementation address from deployment output",
    );
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

async function main() {
  const argv = await parser.argv;
  const cacheFile = LAZER_CACHE_FILE;

  const runIfNotCached = makeCacheFunction(cacheFile);

  const selectedChains = getSelectedChains(argv);

  const vault =
    DefaultStore.vaults[
      "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
    ];

  console.log("Using cache file", cacheFile);

  // Try to deploy on every chain, then collect any failures at the end. This logic makes it simpler to
  // identify deployment problems (e.g., not enough gas) on every chain where they occur.
  const payloads: Buffer[] = [];
  const failures: string[] = [];
  for (const contract of Object.values(DefaultStore.lazer_contracts)) {
    if (selectedChains.includes(contract.chain)) {
      console.log("Deploying implementation to", contract.chain.getId());
      try {
        const address = await runIfNotCached(
          `deploy-${contract.chain.getId()}`,
          () => {
            return deployLazerImplementation(
              contract.chain.getId(),
              contract.chain.rpcUrl,
              argv["private-key"],
            );
          },
        );
        console.log(
          `Deployed implementation at ${address} on ${contract.chain.getId()}`,
        );
        const payload =
          await contract.generateUpgradeLazerContractPayload(address);

        console.log(payload.toString("hex"));
        payloads.push(payload);
      } catch (error) {
        console.log(`error deploying: ${error}`);
        failures.push(contract.chain.getId());
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Some chains could not be deployed: ${failures.join(
        ", ",
      )}. Scroll up to see the errors from each chain.`,
    );
  }

  console.log("Using vault at for proposal", vault?.getId());
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet", wallet.publicKey.toBase58());
  vault?.connect(wallet, registry);
  const proposal = await vault?.proposeWormholeMessage(payloads);
  console.log("Proposal address", proposal?.address.toBase58());
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();

