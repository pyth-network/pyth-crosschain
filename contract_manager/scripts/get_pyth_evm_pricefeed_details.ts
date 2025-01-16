import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { findWormholeContract } from "./common";
import { DefaultStore } from "../src";
import { EvmPriceFeedContract, getDefaultDeploymentConfig } from "../src";
import { getWeb3Contract } from "./common";

interface Config {
  validTimePeriodSeconds: number;
  singleUpdateFeeInWei: number;
  stdOutput: string;
}

// It only works for stable contracts
const parser = yargs(hideBin(process.argv))
  .scriptName("get_pyth_evm_pricefeed_details.ts")
  .usage("Usage: $0 --chain <chain-name>")
  .options({
    contract: {
      type: "string",
      demandOption: true,
      desc: "Contract to get Pyth price feed details for",
    },
    validTimePeriodSeconds: {
      type: "number",
      demandOption: false,
      default: 60,
      desc: "Valid time period in seconds for the price feed",
    },
    singleUpdateFeeInWei: {
      type: "number",
      demandOption: false,
      default: 1,
      desc: "Single update fee in wei for the price feed",
    },
    stdOutput: {
      type: "string",
      demandOption: true,
      default: "../target_chains/ethereum/contracts/build/contracts/",
      desc: "Path to the standard JSON output of the pyth contract (build artifact)",
    },
  });

async function getPythPriceFeedDetails(
  contract: EvmPriceFeedContract,
  config: Config
) {
  // Get wormhole contract from store
  const wormholeContract = findWormholeContract(
    contract.getChain() as EvmChain
  );
  if (!wormholeContract) {
    throw new Error(`Wormhole contract not found for contract ${contract}`);
  }

  // Deploy PythUpgradable contract
  const pythImplAddr = await contract.getImplementationAddress();

  // Get contract instance
  const pythImplContract = getWeb3Contract(
    config.stdOutput,
    "PythUpgradable",
    pythImplAddr
  );

  // Get data sources
  const { dataSources, governanceDataSource } =
    getDefaultDeploymentConfig("stable");

  // Create init data
  const pythInitData = pythImplContract.methods
    .initialize(
      wormholeContract.address,
      dataSources.map((ds) => ds.emitterChain),
      dataSources.map((ds) => "0x" + ds.emitterAddress),
      governanceDataSource.emitterChain,
      "0x" + governanceDataSource.emitterAddress,
      0, // governanceInitialSequence
      config.validTimePeriodSeconds,
      config.singleUpdateFeeInWei
    )
    .encodeABI();

  return {
    pythImplAddr,
    pythInitData,
  };
}

async function main() {
  const argv = await parser.argv;
  const contract = DefaultStore.contracts[argv.contract];
  const validTimePeriodSeconds = argv.validTimePeriodSeconds;
  const singleUpdateFeeInWei = argv.singleUpdateFeeInWei;
  const stdOutput = argv.stdOutput;
  const config: Config = {
    validTimePeriodSeconds,
    singleUpdateFeeInWei,
    stdOutput,
  };

  console.log(`Getting Pyth price feed details for contract ${contract}...`);

  const details = await getPythPriceFeedDetails(
    contract as EvmPriceFeedContract,
    config
  );

  console.log(
    `\nPyth Price Feed Implementation Address: ${details.pythImplAddr}`
  );
  console.log(`Pyth Init Data: ${details.pythInitData}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
