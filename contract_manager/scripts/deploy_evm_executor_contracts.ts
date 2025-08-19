import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/core/chains";
import {
  BaseDeployConfig,
  COMMON_DEPLOY_OPTIONS,
  deployIfNotCached,
  findExecutorContract,
  getOrDeployWormholeContract,
  getWeb3Contract,
} from "./common";
import {
  DeploymentType,
  getDefaultDeploymentConfig,
  toDeploymentType,
  toPrivateKey,
} from "../src/core/base";
import { DefaultStore } from "../src/node/utils/store";
import { EvmExecutorContract } from "../src/core/contracts/evm";

const CACHE_FILE = ".cache-deploy-evm-executor";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_executor.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain>",
  )
  .options({
    ...COMMON_DEPLOY_OPTIONS,
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain to upload the contract on. Can be one of the evm chains available in the store",
    },
  });

interface DeploymentConfig extends BaseDeployConfig {
  type: DeploymentType;
  saveContract: boolean;
}

export async function getOrDeployExecutorContract(
  chain: EvmChain,
  config: DeploymentConfig,
  wormholeAddr: string,
): Promise<EvmExecutorContract> {
  return (
    findExecutorContract(chain) ??
    (await deployExecutorContracts(chain, config, wormholeAddr))
  );
}

/**
 * Deploys the executor contracts for a given EVM chain.
 * @param {EvmChain} chain The EVM chain to deploy the executor contracts for.
 * @param {DeploymentConfig} config The deployment configuration.
 * @param {string} wormholeAddr The address of the wormhole contract.
 * @returns {Promise<string>} The address of the deployed executor contract.
 */
export async function deployExecutorContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  wormholeAddr: string,
): Promise<EvmExecutorContract> {
  const executorImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "ExecutorUpgradable",
    [],
  );

  // Craft the init data for the proxy contract
  const { governanceDataSource } = getDefaultDeploymentConfig(config.type);

  const executorImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "ExecutorUpgradable",
    executorImplAddr,
  );

  const executorInitData = executorImplContract.methods
    .initialize(
      wormholeAddr,
      0, // lastExecutedSequence,
      chain.getWormholeChainId(),
      governanceDataSource.emitterChain,
      `0x${governanceDataSource.emitterAddress}`,
    )
    .encodeABI();

  const executorAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "ERC1967Proxy",
    [executorImplAddr, executorInitData],
  );

  return new EvmExecutorContract(chain, executorAddr);
}

export async function main() {
  const argv = await parser.argv;

  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);

  const deploymentConfig: DeploymentConfig = {
    type: toDeploymentType(argv.deploymentType),
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    privateKey: toPrivateKey(argv.privateKey),
    jsonOutputDir: argv.stdOutputDir,
    saveContract: argv.saveContract,
  };

  const wormholeContract = await getOrDeployWormholeContract(
    chain,
    deploymentConfig,
    CACHE_FILE,
  );

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`,
  );

  console.log(`Deploying executor contracts on ${chain.getId()}...`);

  const executorContract = await getOrDeployExecutorContract(
    chain,
    deploymentConfig,
    wormholeContract.address,
  );

  if (deploymentConfig.saveContract) {
    console.log("Saving the contract in the store...");
    DefaultStore.executor_contracts[executorContract.getId()] =
      executorContract;
    DefaultStore.saveAllContracts();
  }

  console.log(
    `✅ Executor contract on ${chain.getId()} at ${executorContract.address}\n\n`,
  );
}

main();
