import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { DefaultStore } from "../src/store";
import {
  DeploymentType,
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

const CACHE_FILE = ".cache-get-pricefeed";

const parser = yargs(hideBin(process.argv))
  .scriptName("get_pricefeed_details.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain-name>"
  )
  .options({
    ...COMMON_DEPLOY_OPTIONS,
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain name to get price feed details for",
    },
  });

async function getPriceFeedDetails(
  chain: EvmChain,
  config: DeploymentConfig,
  wormholeAddr: string
): Promise<{ pythImplAddr: string; pythInitData: string }> {
  const pythImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "PythUpgradable",
    []
  );

  // Get the init data for the proxy contract
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

  return { pythImplAddr, pythInitData };
}

async function main() {
  const argv = await parser.argv;

  const deploymentConfig: DeploymentConfig = {
    type: toDeploymentType(argv.deploymentType),
    validTimePeriodSeconds: 60, // As specified
    singleUpdateFeeInWei: 1, // As specified
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    privateKey: toPrivateKey(argv.privateKey),
    jsonOutputDir: argv.stdOutputDir,
    saveContract: argv.saveContract,
  };

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`
  );

  const chainName = argv.chain as string;
  const chain = DefaultStore.chains[chainName];
  if (!chain) {
    throw new Error(`Chain ${chainName} not found`);
  } else if (!(chain instanceof EvmChain)) {
    throw new Error(`Chain ${chainName} is not an EVM chain`);
  }

  console.log(`Getting price feed details for ${chain.getId()}...`);

  const wormholeContract = await getOrDeployWormholeContract(
    chain,
    deploymentConfig,
    CACHE_FILE
  );

  const { pythImplAddr, pythInitData } = await getPriceFeedDetails(
    chain,
    deploymentConfig,
    wormholeContract.address
  );

  console.log(`\nPrice Feed Details for ${chain.getId()}:`);
  console.log(`Pyth Implementation Address: ${pythImplAddr}`);
  console.log(`Pyth Init Data: ${pythInitData}\n`);
}

main();
