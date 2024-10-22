require("dotenv").config({ path: ".env" });
import { utils, Wallet } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { CHAINS } from "@pythnetwork/xc-admin-common";
import { assert } from "chai";
import { DefaultStore, EvmChain, EvmWormholeContract } from "@pythnetwork/contract-manager";
import { findWormholeContract, deployWormholeContract } from "./zkSyncDeployWormhole";

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

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);

  

  const {
    wormholeGovernanceChainId,
    wormholeGovernanceContract,
    wormholeInitialSigners,
    governanceEmitter,
    governanceChainId,
    emitterAddresses,
    emitterChainIds,
  } = getDefaultConfig(envOrErr("MIGRATIONS_NETWORK"));

  const chainName = envOrErr("MIGRATIONS_NETWORK");

  const wormholeReceiverChainId = CHAINS[chainName];
  assert(wormholeReceiverChainId !== undefined);

  let wormholeReceiverContractAddress = await findWormholeContract(chainName);
  if (!wormholeReceiverContractAddress) {
    console.log(`Wormhole contract not found for chain ${chainName}`);
    console.log("Deploying Wormhole contract...");
    wormholeReceiverContractAddress  = await deployWormholeContract(deployer, chainName, wormholeGovernanceChainId, wormholeGovernanceContract, wormholeInitialSigners, wormholeReceiverChainId);
  }

  console.log("WormholeReceiver contract address:", wormholeReceiverContractAddress);
  
  // // TODO: Top up accounts if necessary

  const executorContractAddress = await deployExecutorContract(deployer, wormholeReceiverContractAddress, wormholeReceiverChainId, governanceEmitter);

}

async function deployExecutorContract(deployer: Deployer, wormholeReceiverContractAddress: string, wormholeReceiverChainId: number, governanceEmitter: string) {
  const executorImplArtifact = await deployer.loadArtifact("ExecutorUpgradable");
  const executorImplContract = await deployer.deploy(executorImplArtifact);

  const executorInitData = executorImplContract.interface.encodeFunctionData(
    "initialize",
    [
      wormholeReceiverContractAddress,
      0, // lastExecutedSequence,
      wormholeReceiverChainId,
      governanceEmitter,
      governanceEmitter
    ]
  );

  const executorProxyArtifact = await deployer.loadArtifact("ERC1967Proxy");

  const executorProxyContract = await deployer.deploy(executorProxyArtifact, [
    executorImplContract.address,
    executorInitData,
  ]);

  console.log(`Deployed Executor contract on ${executorProxyContract.address}`);

  return executorProxyContract.address;
}
