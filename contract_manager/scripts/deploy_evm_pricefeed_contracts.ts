import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { DefaultStore } from "../src/store";
import {
  DeploymentType,
  EvmPriceFeedContract,
  getDefaultDeploymentConfig,
  toDeploymentType,
  toPrivateKey,
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
  validTimePeriodSeconds: number;
  singleUpdateFeeInWei: number;
  saveContract: boolean;
}

const CACHE_FILE = ".cache-deploy-evm";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_pricefeed_contracts.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain0> --chain <chain1>"
  )
  .options({
    ...COMMON_DEPLOY_OPTIONS,
    "valid-time-period-seconds": {
      type: "number",
      demandOption: false,
      default: 60,
      desc: "Valid time period in seconds for the price feed staleness",
    },
    "single-update-fee-in-wei": {
      type: "number",
      demandOption: false,
      default: 1,
      desc: "Single update fee in wei for the price feed",
    },
  });

async function deployPriceFeedContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  wormholeAddr: string
): Promise<string> {
  const pythImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "PythUpgradable",
    []
  );

  // Craft the init data for the proxy contract
  const { dataSources, governanceDataSource } = getDefaultDeploymentConfig(
    config.type
  );

  const pythImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "PythUpgradable",
    pythImplAddr
  );

  const pythInitData = pythImplContract.methods
    .initialize(
      wormholeAddr,
      dataSources.map((ds) => ds.emitterChain),
      dataSources.map((ds) => "0x" + ds.emitterAddress),
      governanceDataSource.emitterChain,
      "0x" + governanceDataSource.emitterAddress,
      0, // governanceInitialSequence
      config.validTimePeriodSeconds,
      config.singleUpdateFeeInWei
    )
    .encodeABI();

  return await deployIfNotCached(CACHE_FILE, chain, config, "ERC1967Proxy", [
    pythImplAddr,
    pythInitData,
  ]);
}

async function main() {
  const argv = await parser.argv;

  const deploymentConfig: DeploymentConfig = {
    type: toDeploymentType(argv.deploymentType),
    validTimePeriodSeconds: argv.validTimePeriodSeconds,
    singleUpdateFeeInWei: argv.singleUpdateFeeInWei,
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    privateKey: toPrivateKey(argv.privateKey),
    jsonOutputDir: argv.stdOutputDir,
    saveContract: argv.saveContract,
  };

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`
  );

  const chainNames = argv.chain;

  for (const chainName of chainNames) {
    const chain = DefaultStore.chains[chainName];
    if (!chain) {
      throw new Error(`Chain ${chainName} not found`);
    } else if (!(chain instanceof EvmChain)) {
      throw new Error(`Chain ${chainName} is not an EVM chain`);
    }

    console.log(`Deploying price feed contracts on ${chain.getId()}...`);

    const wormholeContract = await getOrDeployWormholeContract(
      chain,
      deploymentConfig,
      CACHE_FILE
    );

    const priceFeedAddr = await deployPriceFeedContracts(
      chain,
      deploymentConfig,
      wormholeContract.address
    );

    if (deploymentConfig.saveContract) {
      console.log("Saving the contract in the store...");
      const contract = new EvmPriceFeedContract(chain, priceFeedAddr);
      DefaultStore.contracts[contract.getId()] = contract;
      DefaultStore.saveAllContracts();
    }

    console.log(
      `✅ Deployed price feed contracts on ${chain.getId()} at ${priceFeedAddr}\n\n`
    );
  }
}

main();
