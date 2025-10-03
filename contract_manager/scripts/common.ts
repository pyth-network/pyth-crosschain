import { DefaultStore } from "../src/node/utils/store";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getContract, encodeFunctionData, formatEther, parseEther } from "viem";
import type { Abi } from "viem";
import { InferredOptionType } from "yargs";
import { PrivateKey, getDefaultDeploymentConfig } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import {
  EvmEntropyContract,
  EvmExecutorContract,
  EvmWormholeContract,
} from "../src/core/contracts";

export interface BaseDeployConfig {
  gasMultiplier: number;
  gasPriceMultiplier: number;
  jsonOutputDir: string;
  privateKey: PrivateKey;
}

// Deploys a contract if it was not deployed before.
// It will check for the past deployments in file `cacheFile` against a key
// If `cacheKey` is provided it will be used as the key, else it will use
// a key - `${chain.getId()}-${artifactName}`
export async function deployIfNotCached(
  cacheFile: string,
  chain: EvmChain,
  config: BaseDeployConfig,
  artifactName: string,
  deployArgs: any[], // eslint-disable-line  @typescript-eslint/no-explicit-any
  cacheKey?: string,
): Promise<string> {
  const runIfNotCached = makeCacheFunction(cacheFile);
  const key = cacheKey ?? `${chain.getId()}-${artifactName}`;
  return runIfNotCached(key, async () => {
    const artifact = JSON.parse(
      readFileSync(
        join(
          config.jsonOutputDir,
          `${artifactName}.sol`,
          `${artifactName}.json`,
        ),
        "utf8",
      ),
    );

    // Handle bytecode which can be either a string or an object with an 'object' property
    let bytecode = artifact["bytecode"];
    if (
      typeof bytecode === "object" &&
      bytecode !== null &&
      "object" in bytecode
    ) {
      bytecode = bytecode.object;
    }

    // Ensure bytecode starts with 0x
    if (!bytecode.startsWith("0x")) {
      bytecode = `0x${bytecode}`;
    }

    console.log(`Deploying ${artifactName} on ${chain.getId()}...`);
    const addr = await chain.deploy(
      config.privateKey,
      artifact["abi"],
      bytecode,
      deployArgs,
      config.gasMultiplier,
      config.gasPriceMultiplier,
    );
    console.log(`✅ Deployed ${artifactName} on ${chain.getId()} at ${addr}`);

    return addr;
  });
}

export function getViemContract(
  chain: EvmChain,
  jsonOutputDir: string,
  artifactName: string,
  address: string,
) {
  const artifact = JSON.parse(
    readFileSync(
      join(jsonOutputDir, `${artifactName}.sol`, `${artifactName}.json`),
      "utf8",
    ),
  );
  const client = chain.getPublicClient();
  return getContract({
    address: address as `0x${string}`,
    abi: artifact["abi"] as Abi,
    client,
  });
}

export const COMMON_DEPLOY_OPTIONS = {
  "std-output-dir": {
    type: "string",
    demandOption: true,
    desc: "Path to the Foundry output directory (contains Contract.sol/Contract.json structure)",
  },
  "private-key": {
    type: "string",
    demandOption: true,
    desc: "Private key to sign the transactions with",
  },
  chain: {
    type: "array",
    string: true,
    demandOption: true,
    desc: "Chains to upload the contract on. Must be one of the chains available in the store",
  },
  "deployment-type": {
    type: "string",
    demandOption: false,
    default: "stable",
    desc: "Deployment type to use. Can be 'stable' or 'beta'",
  },
  "gas-multiplier": {
    type: "number",
    demandOption: false,
    // Proxy (ERC1967) contract gas estimate is insufficient in many networks and thus we use 2 by default to make it work.
    default: 2,
    desc: "Gas multiplier to use for the deployment. This is useful when gas estimates are not accurate",
  },
  "gas-price-multiplier": {
    type: "number",
    demandOption: false,
    default: 1,
    desc: "Gas price multiplier to use for the deployment. This is useful when gas price estimates are not accurate",
  },
  "save-contract": {
    type: "boolean",
    demandOption: false,
    default: true,
    desc: "Save the contract to the store",
  },
} as const;
export const CHAIN_SELECTION_OPTIONS = {
  testnet: {
    type: "boolean",
    default: false,
    desc: "Upgrade testnet contracts instead of mainnet",
  },
  "all-chains": {
    type: "boolean",
    default: false,
    desc: "Upgrade the contract on all chains. Use with --testnet flag to upgrade all testnet contracts",
  },
  chain: {
    type: "array",
    string: true,
    desc: "Chains to upgrade the contract on",
  },
} as const;
export const COMMON_UPGRADE_OPTIONS = {
  ...CHAIN_SELECTION_OPTIONS,
  "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
  "ops-key-path": {
    type: "string",
    demandOption: true,
    desc: "Path to the private key of the proposer to use for the operations multisig governance proposal",
  },
  "std-output": {
    type: "string",
    demandOption: true,
    desc: "Path to the standard JSON output of the pyth contract (build artifact)",
  },
} as const;

export function makeCacheFunction(
  cacheFile: string,
): (cacheKey: string, fn: () => Promise<string>) => Promise<string> {
  async function runIfNotCached(
    cacheKey: string,
    fn: () => Promise<string>,
  ): Promise<string> {
    const cache = existsSync(cacheFile)
      ? JSON.parse(readFileSync(cacheFile, "utf8"))
      : {};
    if (cache[cacheKey]) {
      return cache[cacheKey];
    }
    const result = await fn();
    cache[cacheKey] = result;
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    return result;
  }

  return runIfNotCached;
}

export function getSelectedChains(argv: {
  chain: InferredOptionType<(typeof COMMON_UPGRADE_OPTIONS)["chain"]>;
  testnet: InferredOptionType<(typeof COMMON_UPGRADE_OPTIONS)["testnet"]>;
  allChains: InferredOptionType<(typeof COMMON_UPGRADE_OPTIONS)["all-chains"]>;
}) {
  const selectedChains: EvmChain[] = [];
  if (argv.allChains && argv.chain)
    throw new Error("Cannot use both --all-chains and --chain");
  if (!argv.allChains && !argv.chain)
    throw new Error("Must use either --all-chains or --chain");
  for (const chain of Object.values(DefaultStore.chains)) {
    if (!(chain instanceof EvmChain)) continue;
    if (
      (argv.allChains && chain.isMainnet() !== argv.testnet) ||
      argv.chain?.includes(chain.getId())
    )
      selectedChains.push(chain);
  }
  if (argv.chain && selectedChains.length !== argv.chain.length)
    throw new Error(
      `Some chains were not found ${selectedChains
        .map((chain) => chain.getId())
        .toString()}`,
    );
  for (const chain of selectedChains) {
    if (chain.isMainnet() != selectedChains[0].isMainnet())
      throw new Error("All chains must be either mainnet or testnet");
  }
  return selectedChains;
}

/**
 * Finds the entropy contract for a given EVM chain.
 * @param {EvmChain} chain The EVM chain to find the entropy contract for.
 * @returns The entropy contract for the given EVM chain.
 * @throws {Error} an error if the entropy contract is not found for the given EVM chain.
 */
export function findEntropyContract(chain: EvmChain): EvmEntropyContract {
  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    if (contract.getChain().getId() === chain.getId()) {
      return contract;
    }
  }
  throw new Error(`Entropy contract not found for chain ${chain.getId()}`);
}

/**
 * Finds the wormhole contract for a given EVM chain.
 * @param {EvmChain} chain The EVM chain to find the wormhole contract for.
 * @returns If found, the wormhole contract for the given EVM chain. Else, undefined
 */
export function findWormholeContract(
  chain: EvmChain,
): EvmWormholeContract | undefined {
  for (const contract of Object.values(DefaultStore.wormhole_contracts)) {
    if (
      contract instanceof EvmWormholeContract &&
      contract.getChain().getId() === chain.getId()
    ) {
      return contract;
    }
  }
}

/**
 * Finds the executor contract for a given EVM chain.
 * @param {EvmChain} chain The EVM chain to find the executor contract for.
 * @returns If found, the executor contract for the given EVM chain. Else, undefined
 */
export function findExecutorContract(
  chain: EvmChain,
): EvmExecutorContract | undefined {
  for (const contract of Object.values(DefaultStore.executor_contracts)) {
    if (
      contract instanceof EvmExecutorContract &&
      contract.chain.getId() === chain.getId()
    ) {
      console.log(
        `Found executor contract for ${chain.getId()} at ${contract.address}`,
      );
      return contract;
    }
  }
}

export interface DeployWormholeReceiverContractsConfig
  extends BaseDeployConfig {
  saveContract: boolean;
  type: "stable" | "beta";
}
/**
 * Deploys the wormhole receiver contract for a given EVM chain.
 * @param {EvmChain} chain The EVM chain to find the wormhole receiver contract for.
 * @param {DeployWormholeReceiverContractsConfig} config The deployment configuration.
 * @param {string} cacheFile The path to the cache file.
 * @returns {EvmWormholeContract} The wormhole contract for the given EVM chain.
 */
export async function deployWormholeContract(
  chain: EvmChain,
  config: DeployWormholeReceiverContractsConfig,
  cacheFile: string,
): Promise<EvmWormholeContract> {
  const receiverSetupAddr = await deployIfNotCached(
    cacheFile,
    chain,
    config,
    "ReceiverSetup",
    [],
  );

  const receiverImplAddr = await deployIfNotCached(
    cacheFile,
    chain,
    config,
    "ReceiverImplementation",
    [],
  );

  // Craft the init data for the proxy contract
  const artifact = JSON.parse(
    readFileSync(
      join(config.jsonOutputDir, "ReceiverSetup.sol", "ReceiverSetup.json"),
      "utf8",
    ),
  );

  const { wormholeConfig } = getDefaultDeploymentConfig(config.type);

  const initData = encodeFunctionData({
    abi: artifact["abi"] as Abi,
    functionName: "setup",
    args: [
      receiverImplAddr,
      wormholeConfig.initialGuardianSet.map(
        (addr: string) => ("0x" + addr) as `0x${string}`,
      ),
      chain.getWormholeChainId(),
      wormholeConfig.governanceChainId,
      ("0x" + wormholeConfig.governanceContract) as `0x${string}`,
    ],
  });

  const wormholeReceiverAddr = await deployIfNotCached(
    cacheFile,
    chain,
    config,
    "WormholeReceiver",
    [receiverSetupAddr, initData],
  );

  const wormholeContract = new EvmWormholeContract(chain, wormholeReceiverAddr);

  if (config.type === "stable") {
    console.log(`Syncing mainnet guardian sets for ${chain.getId()}...`);
    // TODO: Add a way to pass gas configs to this
    await wormholeContract.syncMainnetGuardianSets(config.privateKey);
    console.log(`✅ Synced mainnet guardian sets for ${chain.getId()}`);
  }

  if (config.saveContract) {
    DefaultStore.wormhole_contracts[wormholeContract.getId()] =
      wormholeContract;
    DefaultStore.saveAllContracts();
  }

  return wormholeContract;
}

/**
 * Returns the wormhole contract for a given EVM chain.
 * If there was no wormhole contract deployed for the given chain, it will deploy the wormhole contract and save it to the default store.
 * @param {EvmChain} chain The EVM chain to find the wormhole contract for.
 * @param {DeployWormholeReceiverContractsConfig} config The deployment configuration.
 * @param {string} cacheFile The path to the cache file.
 * @returns {EvmWormholeContract} The wormhole contract for the given EVM chain.
 */
export async function getOrDeployWormholeContract(
  chain: EvmChain,
  config: DeployWormholeReceiverContractsConfig,
  cacheFile: string,
): Promise<EvmWormholeContract> {
  return (
    findWormholeContract(chain) ??
    (await deployWormholeContract(chain, config, cacheFile))
  );
}

export interface DefaultAddresses {
  mainnet: string;
  testnet: string;
}

export async function topupAccountsIfNecessary(
  chain: EvmChain,
  deploymentConfig: BaseDeployConfig,
  accounts: Array<[string, DefaultAddresses]>,
  minBalance = 0.01,
) {
  for (const [accountName, defaultAddresses] of accounts) {
    const accountAddress = chain.isMainnet()
      ? defaultAddresses.mainnet
      : defaultAddresses.testnet;
    const publicClient = chain.getPublicClient();
    const walletClient = chain.getWalletClient(deploymentConfig.privateKey);
    const balance = await publicClient.getBalance({
      address: accountAddress as `0x${string}`,
    });
    const balanceEth = Number(formatEther(balance));
    console.log(`${accountName} balance: ${balanceEth} ETH`);
    if (balanceEth < minBalance) {
      console.log(
        `Balance is less than ${minBalance}. Topping up the ${accountName} address...`,
      );
      const topupValue = parseEther(minBalance.toString());
      const estimatedGas = await publicClient.estimateGas({
        account: walletClient.account!,
        to: accountAddress as `0x${string}`,
        value: topupValue,
      });

      const hash = await walletClient.sendTransaction({
        to: accountAddress as `0x${string}`,
        gas: estimatedGas * BigInt(deploymentConfig.gasMultiplier),
        value: topupValue,
      });

      console.log(`Topped up the ${accountName} address. Tx: `, hash);
    }
  }
}
