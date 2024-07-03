import {
  DefaultStore,
  EvmChain,
  EvmEntropyContract,
  EvmWormholeContract,
  getDefaultDeploymentConfig,
  PrivateKey,
} from "../src";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { InferredOptionType } from "yargs";

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
  cacheKey?: string
): Promise<string> {
  const runIfNotCached = makeCacheFunction(cacheFile);
  const key = cacheKey ?? `${chain.getId()}-${artifactName}`;
  return runIfNotCached(key, async () => {
    const artifact = JSON.parse(
      readFileSync(join(config.jsonOutputDir, `${artifactName}.json`), "utf8")
    );

    console.log(`Deploying ${artifactName} on ${chain.getId()}...`);
    const addr = await chain.deploy(
      config.privateKey,
      artifact["abi"],
      artifact["bytecode"],
      deployArgs,
      config.gasMultiplier,
      config.gasPriceMultiplier
    );
    console.log(`✅ Deployed ${artifactName} on ${chain.getId()} at ${addr}`);

    return addr;
  });
}

export function getWeb3Contract(
  jsonOutputDir: string,
  artifactName: string,
  address: string
): Contract {
  const artifact = JSON.parse(
    readFileSync(join(jsonOutputDir, `${artifactName}.json`), "utf8")
  );
  const web3 = new Web3();
  return new web3.eth.Contract(artifact["abi"], address);
}

export const COMMON_DEPLOY_OPTIONS = {
  "std-output-dir": {
    type: "string",
    demandOption: true,
    desc: "Path to the standard JSON output of the contracts (build artifact) directory",
  },
  "private-key": {
    type: "string",
    demandOption: true,
    desc: "Private key to sign the transactions with",
  },
  chain: {
    type: "array",
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
  cacheFile: string
): (cacheKey: string, fn: () => Promise<string>) => Promise<string> {
  async function runIfNotCached(
    cacheKey: string,
    fn: () => Promise<string>
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
  chain: InferredOptionType<typeof COMMON_UPGRADE_OPTIONS["chain"]>;
  testnet: InferredOptionType<typeof COMMON_UPGRADE_OPTIONS["testnet"]>;
  allChains: InferredOptionType<typeof COMMON_UPGRADE_OPTIONS["all-chains"]>;
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
        .toString()}`
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
 * Finds an EVM chain by its name.
 * @param {string} chainName The name of the chain to find.
 * @returns The EVM chain instance.
 * @throws {Error} an error if the chain is not found or is not an EVM chain.
 */
export function findEvmChain(chainName: string): EvmChain {
  const chain = DefaultStore.chains[chainName];
  if (!chain) {
    throw new Error(`Chain ${chainName} not found`);
  } else if (!(chain instanceof EvmChain)) {
    throw new Error(`Chain ${chainName} is not an EVM chain`);
  }
  return chain;
}

/**
 * Finds the wormhole contract for a given EVM chain.
 * @param {EvmChain} chain The EVM chain to find the wormhole contract for.
 * @returns If found, the wormhole contract for the given EVM chain. Else, undefined
 */
export function findWormholeContract(
  chain: EvmChain
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
  cacheFile: string
): Promise<EvmWormholeContract> {
  const receiverSetupAddr = await deployIfNotCached(
    cacheFile,
    chain,
    config,
    "ReceiverSetup",
    []
  );

  const receiverImplAddr = await deployIfNotCached(
    cacheFile,
    chain,
    config,
    "ReceiverImplementation",
    []
  );

  // Craft the init data for the proxy contract
  const setupContract = getWeb3Contract(
    config.jsonOutputDir,
    "ReceiverSetup",
    receiverSetupAddr
  );

  const { wormholeConfig } = getDefaultDeploymentConfig(config.type);

  const initData = setupContract.methods
    .setup(
      receiverImplAddr,
      wormholeConfig.initialGuardianSet.map((addr: string) => "0x" + addr),
      chain.getWormholeChainId(),
      wormholeConfig.governanceChainId,
      "0x" + wormholeConfig.governanceContract
    )
    .encodeABI();

  const wormholeReceiverAddr = await deployIfNotCached(
    cacheFile,
    chain,
    config,
    "WormholeReceiver",
    [receiverSetupAddr, initData]
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
  cacheFile: string
): Promise<EvmWormholeContract> {
  return (
    findWormholeContract(chain) ??
    (await deployWormholeContract(chain, config, cacheFile))
  );
}
