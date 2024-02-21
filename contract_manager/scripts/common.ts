import { DefaultStore, EvmChain, PrivateKey } from "../src";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { InferredOptionType } from "yargs";

interface DeployConfig {
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
  config: DeployConfig,
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
    desc: "Private key to sign the trnasactions with",
  },
  chain: {
    type: "string",
    demandOption: true,
    desc: "Chain to upload the contract on. Can be one of the evm chains available in the store",
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
export const COMMON_UPGRADE_OPTIONS = {
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
