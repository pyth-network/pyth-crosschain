/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable no-console */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { BaseDeployConfig, DefaultAddresses } from "./common";
import {
  COMMON_DEPLOY_OPTIONS,
  deployIfNotCached,
  getWeb3Contract,
  getOrDeployWormholeContract,
  topupAccountsIfNecessary,
} from "./common";
import { getOrDeployExecutorContract } from "./deploy_evm_executor_contracts";
import type { DeploymentType } from "../src/core/base";
import { toDeploymentType, toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import {
  ENTROPY_DEFAULT_KEEPER,
  ENTROPY_DEFAULT_PROVIDER,
  EvmEntropyContract,
} from "../src/core/contracts/evm";
import { DefaultStore } from "../src/node/utils/store";

type DeploymentConfig = {
  type: DeploymentType;
  saveContract: boolean;
} & BaseDeployConfig;

const CACHE_FILE = ".cache-deploy-evm-entropy-contracts";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_entropy_contracts.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain> --wormhole-addr <wormhole-addr>",
  )
  .options({
    ...COMMON_DEPLOY_OPTIONS,
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain to upload the contract on. Can be one of the evm chains available in the store",
    },
  });

async function deployEntropyContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  executorAddr: string,
): Promise<string> {
  const entropyImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "EntropyUpgradable",
    [],
  );

  const entropyImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "EntropyUpgradable",
    entropyImplAddr,
  );

  const entropyInitData = entropyImplContract.methods
    .initialize(
      executorAddr, // owner
      executorAddr, // admin
      1, // pythFeeInWei
      chain.isMainnet()
        ? ENTROPY_DEFAULT_PROVIDER.mainnet
        : ENTROPY_DEFAULT_PROVIDER.testnet,
      true, // prefillRequestStorage
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
    `${chain.getId()}-ERC1967Proxy-ENTROPY`,
  );
}

async function topupEntropyAccountsIfNecessary(
  chain: EvmChain,
  deploymentConfig: DeploymentConfig,
) {
  const accounts: [string, DefaultAddresses][] = [
    ["keeper", ENTROPY_DEFAULT_KEEPER],
    ["provider", ENTROPY_DEFAULT_PROVIDER],
  ];

  await topupAccountsIfNecessary(chain, deploymentConfig, accounts);
}

async function main() {
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

  await topupEntropyAccountsIfNecessary(chain, deploymentConfig);

  const maskedDeploymentConfig = {
    ...deploymentConfig,
    privateKey: deploymentConfig.privateKey ? `<REDACTED>` : undefined,
  };
  console.log(
    `Deployment config: ${JSON.stringify(maskedDeploymentConfig, undefined, 2)}\n`,
  );

  console.log(`Deploying entropy contracts on ${chain.getId()}...`);

  const executorContract = await getOrDeployExecutorContract(
    chain,
    deploymentConfig,
    wormholeContract.address,
  );
  const entropyAddr = await deployEntropyContracts(
    chain,
    deploymentConfig,
    executorContract.address,
  );

  if (deploymentConfig.saveContract) {
    console.log("Saving the contract in the store...");
    const contract = new EvmEntropyContract(chain, entropyAddr);
    DefaultStore.entropy_contracts[contract.getId()] = contract;
    DefaultStore.saveAllContracts();
  }

  console.log(
    `✅ Deployed entropy contracts on ${chain.getId()} at ${entropyAddr}\n\n`,
  );
}

main();
