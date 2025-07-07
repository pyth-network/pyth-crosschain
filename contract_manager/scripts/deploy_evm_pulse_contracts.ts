import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  COMMON_DEPLOY_OPTIONS,
  deployIfNotCached,
  getWeb3Contract,
  getOrDeployWormholeContract,
  BaseDeployConfig,
  topupAccountsIfNecessary,
  DefaultAddresses,
} from "./common";
import fs from "fs";
import path from "path";
import {
  DeploymentType,
  toDeploymentType,
  toPrivateKey,
} from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import {
  PULSE_DEFAULT_PROVIDER,
  PULSE_DEFAULT_KEEPER,
  EvmPulseContract,
} from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

interface DeploymentConfig extends BaseDeployConfig {
  type: DeploymentType;
  saveContract: boolean;
}

const CACHE_FILE = ".cache-deploy-evm-pulse-contracts";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_pulse_contracts.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain> --default-provider <default-provider> --wormhole-addr <wormhole-addr>",
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
  executorAddr: string,
): Promise<string> {
  console.log("Deploying PulseUpgradeable on", chain.getId(), "...");

  // Get the artifact and ensure bytecode is properly formatted
  const pulseArtifact = JSON.parse(
    fs.readFileSync(
      path.join(config.jsonOutputDir, "PulseUpgradeable.json"),
      "utf8",
    ),
  );
  console.log("PulseArtifact bytecode type:", typeof pulseArtifact.bytecode);

  const pulseImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "PulseUpgradeable",
    [],
  );

  console.log("PulseUpgradeable implementation deployed at:", pulseImplAddr);

  const pulseImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "PulseUpgradeable",
    pulseImplAddr,
  );

  console.log("Preparing initialization data...");

  const pulseInitData = pulseImplContract.methods
    .initialize(
      executorAddr, // owner
      executorAddr, // admin
      "1", // pythFeeInWei
      executorAddr, // pythAddress - using executor as a placeholder
      chain.isMainnet()
        ? PULSE_DEFAULT_PROVIDER.mainnet
        : PULSE_DEFAULT_PROVIDER.testnet,
      true, // prefillRequestStorage
      3600, // exclusivityPeriodSeconds - 1 hour
    )
    .encodeABI();

  console.log("Deploying ERC1967Proxy for Pulse...");

  return await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "ERC1967Proxy",
    [pulseImplAddr, pulseInitData],
    // NOTE: we are deploying a ERC1967Proxy when deploying executor
    // we need to provide a different cache key. As the `artifactname`
    // is same in both case which means the cache key will be same
    `${chain.getId()}-ERC1967Proxy-PULSE1`,
  );
}

async function topupPulseAccountsIfNecessary(
  chain: EvmChain,
  deploymentConfig: DeploymentConfig,
) {
  const accounts: Array<[string, DefaultAddresses]> = [
    ["keeper", PULSE_DEFAULT_KEEPER],
    ["provider", PULSE_DEFAULT_PROVIDER],
  ];

  await topupAccountsIfNecessary(chain, deploymentConfig, accounts);
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
    CACHE_FILE,
  );

  await topupPulseAccountsIfNecessary(chain, deploymentConfig);

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`,
  );

  console.log(`Deploying pulse contracts on ${chain.getId()}...`);

  const executorAddr = wormholeContract.address; // Using wormhole contract as executor for Pulse
  const pulseAddr = await deployPulseContracts(
    chain,
    deploymentConfig,
    executorAddr,
  );

  if (deploymentConfig.saveContract) {
    console.log("Saving the contract in the store...");
    const contract = new EvmPulseContract(chain, pulseAddr);
    DefaultStore.pulse_contracts[contract.getId()] = contract;
    DefaultStore.saveAllContracts();
  }

  console.log(
    `✅ Deployed pulse contracts on ${chain.getId()} at ${pulseAddr}\n\n`,
  );
}

main();
