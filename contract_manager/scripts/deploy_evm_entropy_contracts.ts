import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { DefaultStore } from "../src/store";
import {
  DeploymentType,
  EvmEntropyContract,
  getDefaultDeploymentConfig,
  PrivateKey,
  toDeploymentType,
  toPrivateKey,
} from "../src";
import { deployIfNotCached, getWeb3Contract } from "./common";

type DeploymentConfig = {
  type: DeploymentType;
  gasMultiplier: number;
  gasPriceMultiplier: number;
  privateKey: PrivateKey;
  jsonOutputDir: string;
  wormholeAddr: string;
  saveContract: boolean;
};

const CACHE_FILE = ".cache-deploy-evm-entropy-contracts";
const ENTROPY_DEFAULT_PROVIDER = {
  mainnet: "0x4b3D8aA4F753b278323EE88996dffDCd8fBFdBFC",
  testnet: "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344",
};

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_entropy_contracts.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain0> --chain <chain1>"
  )
  .options({
    "std-output-dir": {
      type: "string",
      demandOption: true,
      desc: "Path to the standard JSON output of the contracts (build artifact) directory",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to use for the deployment",
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
      // Pyth Proxy (ERC1967) gas estimate is insufficient in many networks and thus we use 2 by default to make it work.
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
    // TODO: maintain a wormhole store
    "wormhole-addr": {
      type: "string",
      demandOption: true,
      desc: "Wormhole address",
    },
  });

async function deployExecutorContracts(
  chain: EvmChain,
  config: DeploymentConfig
): Promise<string> {
  const executorImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "ExecutorUpgradable",
    []
  );

  // Craft the init data for the proxy contract
  const { governanceDataSource } = getDefaultDeploymentConfig(config.type);

  const executorImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "ExecutorUpgradable",
    executorImplAddr
  );

  const executorInitData = executorImplContract.methods
    .initialize(
      config.wormholeAddr,
      0, // lastExecutedSequence,
      chain.getWormholeChainId(),
      governanceDataSource.emitterChain,
      `0x${governanceDataSource.emitterAddress}`
    )
    .encodeABI();

  return await deployIfNotCached(CACHE_FILE, chain, config, "ERC1967Proxy", [
    executorImplAddr,
    executorInitData,
  ]);
}

async function deployEntropyContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  executorAddr: string
): Promise<string> {
  const entropyImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "EntropyUpgradable",
    []
  );

  const entropyImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "EntropyUpgradable",
    entropyImplAddr
  );

  const entropyInitData = entropyImplContract.methods
    .initialize(
      executorAddr, // owner
      executorAddr, // admin
      1, // pythFeeInWei
      chain.isMainnet()
        ? ENTROPY_DEFAULT_PROVIDER.mainnet
        : ENTROPY_DEFAULT_PROVIDER.testnet,
      true // prefillRequestStorage
    )
    .encodeABI();

  return await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "ERC1967Proxy",
    [entropyImplAddr, entropyInitData],
    // NOTE: we are deploying a ERC1967Proxy when deploying executor
    // we need to provide a different cache key. As the `artifactname`
    // is same in both case which means the cache key will be same
    `${chain.getId()}-ERC1967Proxy-ENTROPY`
  );
}

async function main() {
  const argv = await parser.argv;

  const deploymentConfig: DeploymentConfig = {
    type: toDeploymentType(argv.deploymentType),
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    privateKey: toPrivateKey(argv.privateKey),
    jsonOutputDir: argv.stdOutputDir,
    saveContract: argv.saveContract,
    wormholeAddr: argv.wormholeAddr,
  };

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`
  );

  const chainName = argv.chain;
  const chain = DefaultStore.chains[chainName];
  if (!chain) {
    throw new Error(`Chain ${chainName} not found`);
  } else if (!(chain instanceof EvmChain)) {
    throw new Error(`Chain ${chainName} is not an EVM chain`);
  }

  console.log(`Deploying entropy contracts on ${chain.getId()}...`);

  const executorAddr = await deployExecutorContracts(chain, deploymentConfig);
  const entropyAddr = await deployEntropyContracts(
    chain,
    deploymentConfig,
    executorAddr
  );

  if (deploymentConfig.saveContract) {
    console.log("Saving the contract in the store...");
    const contract = new EvmEntropyContract(chain, entropyAddr);
    DefaultStore.entropy_contracts[contract.getId()] = contract;
    DefaultStore.saveAllContracts();
  }

  console.log(
    `✅ Deployed entropy contracts on ${chain.getId()} at ${entropyAddr}\n\n`
  );
}

main();
