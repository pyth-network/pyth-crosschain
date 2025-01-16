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
  getWeb3Contract,
  getOrDeployWormholeContract,
  BaseDeployConfig,
  findEvmChain,
  deployIfNotCached,
} from "./common";

interface Config extends BaseDeployConfig {
  type: DeploymentType;
}

const parser = yargs(hideBin(process.argv))
  .scriptName("get_pyth_pricefeed_details.ts")
  .usage("Usage: $0 --chain <chain-name>")
  .options({
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain name to get Pyth price feed details for",
    },
    "deployment-type": {
      type: "string",
      demandOption: false,
      default: "stable",
      desc: "Deployment type to use. Can be 'stable' or 'beta'",
    },
  });

async function getPythPriceFeedDetails(chain: EvmChain, config: Config) {
  // Get wormhole contract from store
  const wormholeContract = await getOrDeployWormholeContract(
    chain,
    {
      ...config,
      saveContract: true,
    },
    ".cache-get-details"
  );

  // Deploy PythUpgradable contract
  const pythImplAddr = await deployIfNotCached(
    ".cache-get-details",
    chain,
    config,
    "PythUpgradable",
    []
  );

  // Get deployment config
  const { dataSources, governanceDataSource } = getDefaultDeploymentConfig(
    config.type
  );

  // Get contract instance
  const pythImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "PythUpgradable",
    pythImplAddr
  );

  // Create init data
  const pythInitData = pythImplContract.methods
    .initialize(
      wormholeContract.address,
      dataSources.map((ds) => ds.emitterChain),
      dataSources.map((ds) => "0x" + ds.emitterAddress),
      governanceDataSource.emitterChain,
      "0x" + governanceDataSource.emitterAddress,
      0, // governanceInitialSequence
      60, // validTimePeriodSeconds
      1 // singleUpdateFeeInWei
    )
    .encodeABI();

  return {
    pythImplAddr,
    pythInitData,
  };
}

async function main() {
  const argv = await parser.argv;
  const chain = findEvmChain(argv.chain);

  const config: Config = {
    type: toDeploymentType(argv.deploymentType),
    privateKey: toPrivateKey(process.env.PRIVATE_KEY!), // Will be needed for deployIfNotCached
    jsonOutputDir: process.env.JSON_OUTPUT_DIR!, // Will be needed for contract artifacts
    gasMultiplier: 2,
    gasPriceMultiplier: 1,
  };

  console.log(`Getting Pyth price feed details for chain ${chain.getId()}...`);

  const details = await getPythPriceFeedDetails(chain, config);

  console.log(
    `\nPyth Price Feed Implementation Address: ${details.pythImplAddr}`
  );
  console.log(`Pyth Init Data: ${details.pythInitData}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
