import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  COMMON_DEPLOY_OPTIONS,
  deployIfNotCached,
  getWeb3Contract,
  getOrDeployWormholeContract,
  BaseDeployConfig,
} from "./common";
import { HermesClient } from "@pythnetwork/hermes-client";
import {
  DeploymentType,
  getDefaultDeploymentConfig,
  toDeploymentType,
  toPrivateKey,
} from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { EvmPriceFeedContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

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
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain0> --chain <chain1>",
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
    "single-update-fee-in-usd": {
      type: "number",
      demandOption: false,
      desc: "Single update fee in USD for the price feed. (This overrides the single-update-fee-in-wei option) ",
    },
    "native-token-price-feed-id": {
      type: "string",
      demandOption: false,
      desc: "Pyth Price Feed ID to fetch the current price of the native token (This will be used to calculate the single-update-fee-in-usd)",
    },
    "native-token-decimals": {
      type: "number",
      demandOption: false,
      desc: "Number of decimals of the native token",
    },
  });

async function deployPriceFeedContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  wormholeAddr: string,
): Promise<string> {
  const pythImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "PythUpgradable",
    [],
  );

  // Craft the init data for the proxy contract
  const { dataSources, governanceDataSource } = getDefaultDeploymentConfig(
    config.type,
  );

  const pythImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "PythUpgradable",
    pythImplAddr,
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
      config.singleUpdateFeeInWei,
    )
    .encodeABI();

  return await deployIfNotCached(CACHE_FILE, chain, config, "ERC1967Proxy", [
    pythImplAddr,
    pythInitData,
  ]);
}

async function main() {
  const argv = await parser.argv;
  let singleUpdateFeeInWei = argv.singleUpdateFeeInWei;

  const singleUpdateFeeInUsd = argv["single-update-fee-in-usd"];
  const nativeTokenPriceFeedId = argv["native-token-price-feed-id"];
  const nativeTokenDecimals = argv["native-token-decimals"];
  if (
    singleUpdateFeeInUsd &&
    (nativeTokenPriceFeedId == null || nativeTokenDecimals == null)
  ) {
    throw new Error(
      "native-token-price-feed-id and native-token-decimals are required when single-update-fee-in-usd is provided",
    );
  }

  if (nativeTokenPriceFeedId && singleUpdateFeeInUsd && nativeTokenDecimals) {
    const hermesClient = new HermesClient("https://hermes.pyth.network");
    const priceObject = await hermesClient.getLatestPriceUpdates(
      [nativeTokenPriceFeedId],
      {
        parsed: true,
      },
    );

    const price = priceObject.parsed?.[0].price;
    if (price == null) {
      throw new Error("Failed to get price of the native token");
    }
    const priceInUsd = Number(price.price);
    const exponent = price.expo;
    singleUpdateFeeInWei = Math.round(
      Math.pow(10, nativeTokenDecimals) *
        (singleUpdateFeeInUsd / (priceInUsd * Math.pow(10, exponent))),
    );
    console.log(`Single update fee in wei: ${singleUpdateFeeInWei}`);
  }

  const deploymentConfig: DeploymentConfig = {
    type: toDeploymentType(argv.deploymentType),
    validTimePeriodSeconds: argv.validTimePeriodSeconds,
    singleUpdateFeeInWei: singleUpdateFeeInWei,
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    privateKey: toPrivateKey(argv.privateKey),
    jsonOutputDir: argv.stdOutputDir,
    saveContract: argv.saveContract,
  };

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`,
  );

  const chainNames = argv.chain;

  for (const chainName of chainNames) {
    const chain = DefaultStore.getChainOrThrow(chainName, EvmChain);

    console.log(`Deploying price feed contracts on ${chain.getId()}...`);

    const wormholeContract = await getOrDeployWormholeContract(
      chain,
      deploymentConfig,
      CACHE_FILE,
    );

    const priceFeedAddr = await deployPriceFeedContracts(
      chain,
      deploymentConfig,
      wormholeContract.address,
    );

    if (deploymentConfig.saveContract) {
      console.log("Saving the contract in the store...");
      const contract = new EvmPriceFeedContract(chain, priceFeedAddr);
      DefaultStore.contracts[contract.getId()] = contract;
      DefaultStore.saveAllContracts();
    }

    console.log(
      `✅ Deployed price feed contracts on ${chain.getId()} at ${priceFeedAddr}\n\n`,
    );
  }
}

main();
