require("dotenv").config({ path: ".env" });
import { utils, Wallet } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { CHAINS } from "@pythnetwork/xc-admin-common";
import { assert } from "chai";
import {
  DefaultStore,
  EvmChain,
  EvmEntropyContract,
  EvmWormholeContract,
  ENTROPY_DEFAULT_PROVIDER,
} from "@pythnetwork/contract-manager";
import {
  findWormholeContract,
  deployWormholeContract,
} from "./zkSyncDeployWormhole";

// import {Wallet as ZkWallet} from "zksync-ethers";      // Use These packages if "zksync-web3" doesn't work
// import { Deployer as ZkDeployer } from "@matterlabs/hardhat-zksync";

const { getDefaultConfig } = require("../scripts/contractManagerConfig");

function envOrErr(name: string): string {
  const res = process.env[name];
  if (res === undefined) {
    throw new Error(`${name} environment variable is not set.`);
  }
  return res;
}

export default async function (hre: HardhatRuntimeEnvironment) {
  // Initialize the wallet.
  const wallet = Wallet.fromMnemonic(envOrErr("MNEMONIC"));
  const isMainnet = envOrErr("MAINNET") === "true";

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);

  const {
    wormholeGovernanceChainId,
    wormholeGovernanceContract,
    wormholeInitialSigners,
    governanceEmitter,
    governanceChainId,
  } = getDefaultConfig(envOrErr("MIGRATIONS_NETWORK"));
  const chainName = envOrErr("MIGRATIONS_NETWORK");

  const wormholeReceiverChainId = CHAINS[chainName];
  assert(wormholeReceiverChainId !== undefined);

  let wormholeReceiverContractAddress = await findWormholeContract(chainName);
  if (!wormholeReceiverContractAddress) {
    console.log(`Wormhole contract not found for chain ${chainName}`);
    console.log("Deploying Wormhole contract...");
    wormholeReceiverContractAddress = await deployWormholeContract(
      deployer,
      chainName,
      wormholeGovernanceChainId,
      wormholeGovernanceContract,
      wormholeInitialSigners,
      wormholeReceiverChainId,
    );
  }

  console.log(
    "WormholeReceiver contract address:",
    wormholeReceiverContractAddress,
  );

  // // TODO: Top up accounts if necessary

  const executorContractAddress = await deployExecutorContract(
    deployer,
    wormholeReceiverContractAddress,
    wormholeReceiverChainId,
    governanceChainId,
    governanceEmitter,
  );

  console.log("Executor contract address:", executorContractAddress);

  const entropyContractAddress = await deployEntropyContract(
    deployer,
    executorContractAddress,
    wormholeReceiverChainId,
    isMainnet,
  );

  console.log("Entropy contract address:", entropyContractAddress);

  console.log("Saving the contract in the store...");
  const chain = DefaultStore.chains[chainName];
  const contract = new EvmEntropyContract(chain, entropyContractAddress);
  DefaultStore.entropy_contracts[contract.getId()] = contract;
  DefaultStore.saveAllContracts();
}

async function deployExecutorContract(
  deployer: Deployer,
  wormholeReceiverContractAddress: string,
  wormholeReceiverChainId: number,
  governanceChainId: string,
  governanceEmitter: string,
) {
  const executorImplArtifact =
    await deployer.loadArtifact("ExecutorUpgradable");
  const executorImplContract = await deployer.deploy(executorImplArtifact);
  console.log(
    "Deployed ExecutorImpl contract on",
    executorImplContract.address,
  );

  const executorInitData = executorImplContract.interface.encodeFunctionData(
    "initialize",
    [
      wormholeReceiverContractAddress,
      0, // lastExecutedSequence,
      wormholeReceiverChainId,
      governanceChainId,
      governanceEmitter,
    ],
  );

  const executorProxyArtifact = await deployer.loadArtifact("ERC1967Proxy");

  const executorProxyContract = await deployer.deploy(executorProxyArtifact, [
    executorImplContract.address,
    executorInitData,
  ]);

  console.log(`Deployed Executor contract on ${executorProxyContract.address}`);

  return executorProxyContract.address;
}

async function deployEntropyContract(
  deployer: Deployer,
  executorContractAddress: string,
  chainId: number,
  isMainnet: boolean,
) {
  const entropyImplArtifact = await deployer.loadArtifact("EntropyUpgradable");
  const entropyImplContract = await deployer.deploy(entropyImplArtifact);

  const entropyInitData = entropyImplContract.interface.encodeFunctionData(
    "initialize",
    [
      executorContractAddress,
      executorContractAddress,
      1, // pythFeeInWei
      isMainnet
        ? ENTROPY_DEFAULT_PROVIDER.mainnet
        : ENTROPY_DEFAULT_PROVIDER.testnet,
      true,
    ],
  );

  const entropyProxyArtifact = await deployer.loadArtifact("ERC1967Proxy");
  const entropyProxyContract = await deployer.deploy(entropyProxyArtifact, [
    entropyImplContract.address,
    entropyInitData,
  ]);

  return entropyProxyContract.address;
}
