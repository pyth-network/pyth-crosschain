/* eslint-disable tsdoc/syntax */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Web3 from "web3";
import type { Contract } from "web3-eth-contract";
import type { InferredOptionType } from "yargs";

import type { DeploymentType, PrivateKey } from "../src/core/base";
import { getDefaultDeploymentConfig } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import type { EvmEntropyContract } from "../src/core/contracts";
import {
  EvmExecutorContract,
  EvmWormholeContract,
} from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

export type BaseDeployConfig = {
  type: DeploymentType;
  gasMultiplier: number;
  gasPriceMultiplier: number;
  jsonOutputDir: string;
  privateKey: PrivateKey;
};

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
  const key = cacheKey ?? `${chain.getId()}-${artifactName}-${config.type}`;
  return runIfNotCached(key, async () => {
    const artifact = JSON.parse(
      readFileSync(
        path.join(
          config.jsonOutputDir,
          `${artifactName}.sol`,
          `${artifactName}.json`,
        ),
        "utf8",
      ),
    );

    // Handle bytecode which can be either a string or an object with an 'object' property
    let bytecode = artifact.bytecode;
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
      artifact.abi,
      bytecode,
      deployArgs,
      config.gasMultiplier,
      config.gasPriceMultiplier,
    );
    console.log(`✅ Deployed ${artifactName} on ${chain.getId()} at ${addr}`);

    return addr;
  });
}

export function getWeb3Contract(
  jsonOutputDir: string,
  artifactName: string,
  address: string,
): Contract {
  const artifact = JSON.parse(
    readFileSync(
      path.join(jsonOutputDir, `${artifactName}.sol`, `${artifactName}.json`),
      "utf8",
    ),
  );
  const web3 = new Web3();
  return new web3.eth.Contract(artifact.abi, address);
}

export const COMMON_DEPLOY_OPTIONS = {
  chain: {
    demandOption: true,
    desc: "Chains to upload the contract on. Must be one of the chains available in the store",
    string: true,
    type: "array",
  },
  "deployment-type": {
    default: "stable",
    demandOption: false,
    desc: "Deployment type to use. Can be 'stable', 'beta', 'lazer-staging', or 'lazer-prod'",
    type: "string",
  },
  "gas-multiplier": {
    // Proxy (ERC1967) contract gas estimate is insufficient in many networks and thus we use 2 by default to make it work.
    default: 2,
    demandOption: false,
    desc: "Gas multiplier to use for the deployment. This is useful when gas estimates are not accurate",
    type: "number",
  },
  "gas-price-multiplier": {
    default: 1,
    demandOption: false,
    desc: "Gas price multiplier to use for the deployment. This is useful when gas price estimates are not accurate",
    type: "number",
  },
  "private-key": {
    demandOption: true,
    desc: "Private key to sign the transactions with",
    type: "string",
  },
  "save-contract": {
    default: true,
    demandOption: false,
    desc: "Save the contract to the store",
    type: "boolean",
  },
  "std-output-dir": {
    demandOption: true,
    desc: "Path to the Foundry output directory (typically 'out/' directory, contains Contract.sol/Contract.json structure)",
    type: "string",
  },
} as const;
export const CHAIN_SELECTION_OPTIONS = {
  "all-chains": {
    default: false,
    desc: "Upgrade the contract on all chains. Use with --testnet flag to upgrade all testnet contracts",
    type: "boolean",
  },
  chain: {
    desc: "Chains to upgrade the contract on",
    string: true,
    type: "array",
  },
  testnet: {
    default: false,
    desc: "Upgrade testnet contracts instead of mainnet",
    type: "boolean",
  },
} as const;
export const COMMON_UPGRADE_OPTIONS = {
  ...CHAIN_SELECTION_OPTIONS,
  "ops-key-path": {
    demandOption: true,
    desc: "Path to the private key of the proposer to use for the operations multisig governance proposal",
    type: "string",
  },
  "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
  "std-output": {
    demandOption: false,
    desc: "Path to the standard JSON output of the pyth contract (build artifact)",
    type: "string",
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
    writeFileSync(cacheFile, JSON.stringify(cache, undefined, 2));
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
    if (chain.isMainnet() != selectedChains[0]?.isMainnet())
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
 * Finds the wormhole contract for a given EVM chain and guardian set source.
 * @param {EvmChain} chain The EVM chain to find the wormhole contract for.
 * @param {"wormhole" | "lazer"} guardianSetSource The guardian set source to filter by.
 * @returns If found, the wormhole contract for the given EVM chain and source. Else, undefined
 */
export function findWormholeContract(
  chain: EvmChain,
  guardianSetSource: "wormhole" | "lazer",
): EvmWormholeContract | undefined {
  for (const contract of Object.values(DefaultStore.wormhole_contracts)) {
    if (
      contract instanceof EvmWormholeContract &&
      contract.getChain().getId() === chain.getId() &&
      contract.guardianSetSource === guardianSetSource
    ) {
      return contract;
    }
  }
  return;
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
  return;
}

export type DeployWormholeReceiverContractsConfig = {
  saveContract: boolean;
  type: DeploymentType;
} & BaseDeployConfig;
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
  const { wormholeConfig } = getDefaultDeploymentConfig(config.type);

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
    wormholeConfig.guardianSetSource === "lazer"
      ? "ReceiverImplementationHalf"
      : "ReceiverImplementation",
    [],
  );

  // Craft the init data for the proxy contract
  const setupContract = getWeb3Contract(
    config.jsonOutputDir,
    "ReceiverSetup",
    receiverSetupAddr,
  );

  const initData = setupContract.methods
    .setup(
      receiverImplAddr,
      wormholeConfig.initialGuardianSet.map((addr: string) => "0x" + addr),
      chain.getWormholeChainId(),
      wormholeConfig.governanceChainId,
      "0x" + wormholeConfig.governanceContract,
    )
    .encodeABI();

  const wormholeReceiverAddr = await deployIfNotCached(
    cacheFile,
    chain,
    config,
    "WormholeReceiver",
    [receiverSetupAddr, initData],
  );

  const wormholeContract = new EvmWormholeContract(
    chain,
    wormholeReceiverAddr,
    wormholeConfig.guardianSetSource,
  );

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
  const { wormholeConfig } = getDefaultDeploymentConfig(config.type);
  return (
    findWormholeContract(chain, wormholeConfig.guardianSetSource) ??
    (await deployWormholeContract(chain, config, cacheFile))
  );
}

export type DefaultAddresses = {
  mainnet: string;
  testnet: string;
};

export async function topupAccountsIfNecessary(
  chain: EvmChain,
  deploymentConfig: BaseDeployConfig,
  accounts: [string, DefaultAddresses][],
  minBalance = 0.01,
) {
  for (const [accountName, defaultAddresses] of accounts) {
    const accountAddress = chain.isMainnet()
      ? defaultAddresses.mainnet
      : defaultAddresses.testnet;
    const web3 = chain.getWeb3();
    const balance = Number(
      web3.utils.fromWei(await web3.eth.getBalance(accountAddress), "ether"),
    );
    console.log(`${accountName} balance: ${balance} ETH`);
    if (balance < minBalance) {
      console.log(
        `Balance is less than ${minBalance}. Topping up the ${accountName} address...`,
      );
      const signer = web3.eth.accounts.privateKeyToAccount(
        deploymentConfig.privateKey,
      );
      web3.eth.accounts.wallet.add(signer);

      // Get the current nonce to avoid conflicts with pending transactions
      const nonce = await web3.eth.getTransactionCount(
        signer.address,
        "pending",
      );
      console.log(`Using nonce: ${nonce}`);

      // Get gas price and apply multiplier
      const baseGasPrice = await chain.getGasPrice();
      const gasPrice = Math.trunc(
        Number(baseGasPrice) * deploymentConfig.gasPriceMultiplier,
      );

      const estimatedGas = await web3.eth.estimateGas({
        from: signer.address,
        to: accountAddress,
        value: web3.utils.toWei(`${minBalance}`, "ether"),
      });

      const tx = await web3.eth.sendTransaction({
        from: signer.address,
        gas: estimatedGas * deploymentConfig.gasMultiplier,
        gasPrice: gasPrice.toString(),
        nonce: nonce,
        to: accountAddress,
        value: web3.utils.toWei(`${minBalance}`, "ether"),
        // // Uncomment this if your tx are getting stuck in the mempool. Or if you get this error:
        // // "An existing transaction had higher priority"
        // maxPriorityFeePerGas: gasPrice.toString(),
      });

      console.log(
        `Topped up the ${accountName} address. Tx:`,
        tx.transactionHash,
      );
    }
  }
}
