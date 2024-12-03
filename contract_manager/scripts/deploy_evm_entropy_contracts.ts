import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { DefaultStore } from "../src/store";
import {
  DeploymentType,
  ENTROPY_DEFAULT_KEEPER,
  ENTROPY_DEFAULT_PROVIDER,
  EvmEntropyContract,
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
import Web3 from "web3";

interface DeploymentConfig extends BaseDeployConfig {
  type: DeploymentType;
  saveContract: boolean;
}

const CACHE_FILE = ".cache-deploy-evm-entropy-contracts";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_entropy_contracts.ts")
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

async function deployExecutorContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  wormholeAddr: string
): Promise<string> {
  const executorImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "ExecutorUpgradable",
    []
  );

  // Craft the init data for the proxy contract
  const { governanceDataSource } = getDefaultDeploymentConfig(config.type);

  const executorImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "ExecutorUpgradable",
    executorImplAddr
  );

  const executorInitData = executorImplContract.methods
    .initialize(
      wormholeAddr,
      0, // lastExecutedSequence,
      chain.getWormholeChainId(),
      governanceDataSource.emitterChain,
      `0x${governanceDataSource.emitterAddress}`
    )
    .encodeABI();

  return await deployIfNotCached(CACHE_FILE, chain, config, "ERC1967Proxy", [
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
    CACHE_FILE,
    chain,
    config,
    "EntropyUpgradable",
    []
  );

  const entropyImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "EntropyUpgradable",
    entropyImplAddr
  );

  const entropyInitData = entropyImplContract.methods
    .initialize(
      executorAddr, // owner
      executorAddr, // admin
      1, // pythFeeInWei
      chain.isMainnet()
        ? ENTROPY_DEFAULT_PROVIDER.mainnet
        : ENTROPY_DEFAULT_PROVIDER.testnet,
      true // prefillRequestStorage
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
    `${chain.getId()}-ERC1967Proxy-ENTROPY`
  );
}

async function topupAccountsIfNecessary(
  chain: EvmChain,
  deploymentConfig: DeploymentConfig
) {
  for (const [accountName, defaultAddresses] of [
    ["keeper", ENTROPY_DEFAULT_KEEPER],
    ["provider", ENTROPY_DEFAULT_PROVIDER],
  ] as const) {
    const accountAddress = chain.isMainnet()
      ? defaultAddresses.mainnet
      : defaultAddresses.testnet;
    const web3 = chain.getWeb3();
    const balance = Number(
      web3.utils.fromWei(await web3.eth.getBalance(accountAddress), "ether")
    );
    const MIN_BALANCE = 0.01;
    console.log(`${accountName} balance: ${balance} ETH`);
    if (balance < MIN_BALANCE) {
      console.log(
        `Balance is less than ${MIN_BALANCE}. Topping up the ${accountName} address...`
      );
      const signer = web3.eth.accounts.privateKeyToAccount(
        deploymentConfig.privateKey
      );
      web3.eth.accounts.wallet.add(signer);
      const estimatedGas = await web3.eth.estimateGas({
        from: signer.address,
        to: accountAddress,
        value: web3.utils.toWei(`${MIN_BALANCE}`, "ether"),
      });

      const tx = await web3.eth.sendTransaction({
        from: signer.address,
        to: accountAddress,
        gas: estimatedGas * deploymentConfig.gasMultiplier,
        value: web3.utils.toWei(`${MIN_BALANCE}`, "ether"),
      });

      console.log(
        `Topped up the ${accountName} address. Tx: `,
        tx.transactionHash
      );
    }
  }
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

  await topupAccountsIfNecessary(chain, deploymentConfig);

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`
  );

  console.log(`Deploying entropy contracts on ${chain.getId()}...`);

  const executorAddr = await deployExecutorContracts(
    chain,
    deploymentConfig,
    wormholeContract.address
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
