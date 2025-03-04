import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { DefaultStore } from "../src/store";
import {
  DeploymentType,
  toDeploymentType,
  toPrivateKey,
  getDefaultDeploymentConfig,
  EvmPulseContract,
} from "../src";
import {
  COMMON_DEPLOY_OPTIONS,
  deployIfNotCached,
  getWeb3Contract,
  getOrDeployWormholeContract,
  BaseDeployConfig,
} from "./common";

interface DeploymentConfig extends BaseDeployConfig {
  type: DeploymentType;
  saveContract: boolean;
}

const CACHE_FILE = ".cache-deploy-evm-pulse-contracts";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_pulse_contracts.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain> --wormhole-addr <wormhole-addr>"
  )
  .options({
    ...COMMON_DEPLOY_OPTIONS,
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain to upload the contract on. Can be one of the evm chains available in the store",
    },
  });

async function deployPulseContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  executorAddr: string
): Promise<string> {
  const pulseImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "PulseUpgradeable",
    []
  );

  const pulseImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "PulseUpgradeable",
    pulseImplAddr
  );

  const { governanceDataSource } = getDefaultDeploymentConfig(config.type);

  const pulseInitData = pulseImplContract.methods
    .initialize(
      executorAddr, // owner
      executorAddr, // admin
      chain.getWormholeChainId(),
      governanceDataSource.emitterChain,
      `0x${governanceDataSource.emitterAddress}`
    )
    .encodeABI();

  return await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "ERC1967Proxy",
    [pulseImplAddr, pulseInitData],
    `${chain.getId()}-ERC1967Proxy-PULSE`
  );
}

async function main() {
  const argv = await parser.argv;

  const chainName = argv.chain;
  const chain = DefaultStore.chains[chainName];
  if (!chain) {
    throw new Error(`Chain ${chainName} not found`);
  } else if (!(chain instanceof EvmChain)) {
    throw new Error(`Chain ${chainName} is not an EVM chain`);
  }

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
    CACHE_FILE
  );

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`
  );

  console.log(`Deploying pulse contracts on ${chain.getId()}...`);

  const executorAddr = wormholeContract.address; // Using wormhole contract as executor for Pulse
  const pulseAddr = await deployPulseContracts(
    chain,
    deploymentConfig,
    executorAddr
  );

  if (deploymentConfig.saveContract) {
    console.log("Saving the contract in the store...");
    const contract = new EvmPulseContract(chain, pulseAddr);
    DefaultStore.pulse_contracts[contract.getId()] = contract;
    DefaultStore.saveAllContracts();
  }

  console.log(
    `✅ Deployed pulse contracts on ${chain.getId()} at ${pulseAddr}\n\n`
  );
}

main();
