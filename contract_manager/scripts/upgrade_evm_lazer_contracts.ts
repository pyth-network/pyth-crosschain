/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import upgradeVaults from "../src/store/vaults/UpgradeVaults.json";

const LAZER_CACHE_FILE = ".cache-upgrade-evm-lazer-contract";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Deploys a new PythLazer implementation contract to a set of chains and creates a governance proposal for upgrading the proxy.\n" +
      "Uses a cache file to avoid deploying contracts twice\n" +
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

type UpgradeImplementationOutput = {
  implementationAddress: string;
  chainId: number;
};

function deployLazerImplementation(
  chain: string,
  rpcUrl: string,
  privateKey: string,
  chainNetworkId: number,
): Promise<string> {
  // Resolve path relative to this script's location, not CWD
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const lazerContractsDir = path.resolve(
    scriptDir,
    "../../lazer/contracts/evm",
  );
  const upgradeOutputPath = path.join(
    lazerContractsDir,
    "upgrade-implementation-output.json",
  );

  // Build forge command to deploy only the implementation
  const forgeCommand = `forge script script/PythLazerDeploy.s.sol --rpc-url ${rpcUrl} --private-key ${privateKey} --broadcast --sig "deployImplementationForUpgrade()"`;

  try {
    console.log(`Deploying PythLazer implementation to ${chain}...`);
    console.log(`RPC URL: ${rpcUrl}`);

    // Clean up any previous upgrade output
    if (existsSync(upgradeOutputPath)) {
      unlinkSync(upgradeOutputPath);
    }

    // Execute forge script
    console.log("Running forge deployment script...");
    const output = execSync(forgeCommand, {
      cwd: lazerContractsDir,
      encoding: "utf8",
      stdio: "pipe",
    });

    console.log(output);

    // Read upgrade output from JSON file written by the forge script
    if (!existsSync(upgradeOutputPath)) {
      throw new Error(
        "Upgrade output file not found. Deployment may have failed.",
      );
    }

    const upgradeOutput = JSON.parse(
      readFileSync(upgradeOutputPath, "utf8"),
    ) as UpgradeImplementationOutput;

    // Verify chain ID matches
    if (upgradeOutput.chainId !== chainNetworkId) {
      throw new Error(
        `Chain ID mismatch: expected ${chainNetworkId}, got ${upgradeOutput.chainId}`,
      );
    }

    console.log(
      `\nPythLazer implementation deployed at: ${upgradeOutput.implementationAddress}`,
    );

    // Clean up the output file
    unlinkSync(upgradeOutputPath);

    return Promise.resolve(upgradeOutput.implementationAddress);
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

  const mainnetVault = upgradeVaults.find(
    (v) => v.cluster === "mainnet-beta" && v.type === "vault",
  );
  if (!mainnetVault)
    throw new Error("Mainnet vault not found in UpgradeVaults.json");
  const vault =
    DefaultStore.vaults[`${mainnetVault.cluster}_${mainnetVault.key}`];

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
              contract.chain.networkId,
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
