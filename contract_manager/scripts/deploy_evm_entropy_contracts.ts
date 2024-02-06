import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { DefaultStore } from "../src/store";
import { existsSync, readFileSync, writeFileSync } from "fs";
import {
  DeploymentType,
  EvmEntropyContract,
  getDefaultDeploymentConfig,
  PrivateKey,
  toDeploymentType,
  toPrivateKey,
} from "../src";
import { join } from "path";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";

type DeploymentConfig = {
  type: DeploymentType;
  gasMultiplier: number;
  gasPriceMultiplier: number;
  privateKey: PrivateKey;
  jsonOutputDir: string;
  saveContract: boolean;
};

const CACHE_FILE = ".cache-deploy-evm-entropy-contracts";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_pricefeed_contracts.ts")
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

async function deployIfNotCached(
  chain: EvmChain,
  config: DeploymentConfig,
  artifactName: string,
  deployArgs: any[] // eslint-disable-line  @typescript-eslint/no-explicit-any
): Promise<string> {
  const cache = existsSync(CACHE_FILE)
    ? JSON.parse(readFileSync(CACHE_FILE, "utf8"))
    : {};

  const cacheKey = `${chain.getId()}-${artifactName}`;
  if (cache[cacheKey]) {
    const address = cache[cacheKey];
    console.log(
      `Using cached deployment of ${artifactName} on ${chain.getId()} at ${address}`
    );
    return address;
  }

  const artifact = JSON.parse(
    readFileSync(join(config.jsonOutputDir, `${artifactName}.json`), "utf8")
  );

  console.log(`Deploying ${artifactName} on ${chain.getId()}...`);

  const addr = await chain.deploy(
    config.privateKey,
    artifact["abi"],
    artifact["bytecode"],
    deployArgs,
    config.gasMultiplier,
    config.gasPriceMultiplier
  );

  console.log(`✅ Deployed ${artifactName} on ${chain.getId()} at ${addr}`);

  cache[cacheKey] = addr;
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  return addr;
}

function getWeb3Contract(
  config: DeploymentConfig,
  artifactName: string,
  address: string
): Contract {
  const artifact = JSON.parse(
    readFileSync(join(config.jsonOutputDir, `${artifactName}.json`), "utf8")
  );
  const web3 = new Web3();
  return new web3.eth.Contract(artifact["abi"], address);
}

async function deployExecutorContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  wormholeAddr: string
): Promise<string> {
  const executorImplAddr = await deployIfNotCached(
    chain,
    config,
    "ExecutorUpgradable",
    []
  );

  // Craft the init data for the proxy contract
  const { governanceDataSource } = getDefaultDeploymentConfig(config.type);

  const executorImplContract = getWeb3Contract(
    config,
    "ExecutorUpgradable",
    executorImplAddr
  );

  const executorInitData = executorImplContract.methods
    .initialize(
      wormholeAddr,
      0, // lastExecutedSequence,
      chain.getWormholeChainId(),
      governanceDataSource.emitterChain,
      governanceDataSource.emitterAddress
    )
    .encodeABI();

  return await deployIfNotCached(chain, config, "ERC1967Proxy", [
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
    chain,
    config,
    "EntropyUpgradable",
    []
  );

  const entropyImplContract = getWeb3Contract(
    config,
    "EntropyUpgradable",
    entropyImplAddr
  );

  const entropyInitData = entropyImplContract.methods
    .initialize(
      executorAddr, // owner
      executorAddr, // admin
      1, // pythFeeInWei
      chain.isMainnet()
        ? "0x4b3D8aA4F753b278323EE88996dffDCd8fBFdBFC"
        : "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344", // defaultProvider
      true // prefillRequestStorage
    )
    .encodeABI();

  return await deployIfNotCached(chain, config, "ERC1967Proxy", [
    entropyImplAddr,
    entropyInitData,
  ]);
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

  const executorAddr = await deployExecutorContracts(
    chain,
    deploymentConfig,
    argv.wormholeAddr
  );
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
