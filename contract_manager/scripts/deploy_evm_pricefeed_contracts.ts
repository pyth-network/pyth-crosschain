/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */

import { HermesClient } from "@pythnetwork/hermes-client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { DeploymentType } from "../src/core/base";
import {
  getDefaultDeploymentConfig,
  toDeploymentType,
  toPrivateKey,
} from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { EvmPriceFeedContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import type { BaseDeployConfig } from "./common";
import {
  COMMON_DEPLOY_OPTIONS,
  deployIfNotCached,
  getOrDeployWormholeContract,
  getWeb3Contract,
} from "./common";

type DeploymentConfig = {
  type: DeploymentType;
  validTimePeriodSeconds: number;
  singleUpdateFeeInWei: number;
  saveContract: boolean;
} & BaseDeployConfig;

const CACHE_FILE = ".cache-deploy-evm";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_pricefeed_contracts.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain0> --chain <chain1>",
  )
  .options({
    ...COMMON_DEPLOY_OPTIONS,
    "native-token-decimals": {
      demandOption: false,
      desc: "Number of decimals of the native token",
      type: "number",
    },
    "native-token-price-feed-id": {
      demandOption: false,
      desc: "Pyth Price Feed ID to fetch the current price of the native token (This will be used to calculate the single-update-fee-in-usd)",
      type: "string",
    },
    "single-update-fee-in-usd": {
      demandOption: false,
      desc: "Single update fee in USD for the price feed. (This overrides the single-update-fee-in-wei option) ",
      type: "number",
    },
    "single-update-fee-in-wei": {
      default: 1,
      demandOption: false,
      desc: "Single update fee in wei for the price feed",
      type: "number",
    },
    "valid-time-period-seconds": {
      default: 60,
      demandOption: false,
      desc: "Valid time period in seconds for the price feed staleness",
      type: "number",
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
    (nativeTokenPriceFeedId == undefined || nativeTokenDecimals == undefined)
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

    const price = priceObject.parsed?.[0]?.price;
    if (price == undefined) {
      throw new Error("Failed to get price of the native token");
    }
    const priceInUsd = Number(price.price);
    const exponent = price.expo;
    singleUpdateFeeInWei = Math.round(
      Math.pow(10, nativeTokenDecimals) *
        (singleUpdateFeeInUsd / (priceInUsd * Math.pow(10, exponent))),
    );
  }

  const deploymentConfig: DeploymentConfig = {
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    jsonOutputDir: argv.stdOutputDir,
    privateKey: toPrivateKey(argv.privateKey),
    saveContract: argv.saveContract,
    singleUpdateFeeInWei: singleUpdateFeeInWei,
    type: toDeploymentType(argv.deploymentType),
    validTimePeriodSeconds: argv.validTimePeriodSeconds,
  };

  const _maskedDeploymentConfig = {
    ...deploymentConfig,
    privateKey: deploymentConfig.privateKey ? `<REDACTED>` : undefined,
  };

  const chainNames = argv.chain;

  for (const chainName of chainNames) {
    const chain = DefaultStore.getChainOrThrow(chainName, EvmChain);

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
      const contract = new EvmPriceFeedContract(chain, priceFeedAddr);
      DefaultStore.contracts[contract.getId()] = contract;
      DefaultStore.saveAllContracts();
    }
  }
}

main();
