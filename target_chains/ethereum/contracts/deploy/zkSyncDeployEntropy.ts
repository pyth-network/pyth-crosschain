require("dotenv").config({ path: ".env" });
import { utils, Wallet } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { CHAINS } from "@pythnetwork/xc-admin-common";
import { assert } from "chai";
import { DefaultStore, EvmChain, EvmWormholeContract } from "@pythnetwork/contract-manager";
import { findWormholeContract } from "./zkSyncDeployWormhole";

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
  // const wallet = Wallet.fromMnemonic(envOrErr("MNEMONIC"));

  // Create deployer object and load the artifact of the contract we want to deploy.
  // const deployer = new Deployer(hre, wallet);

  // const {
  //   wormholeGovernanceChainId,
  //   wormholeGovernanceContract,
  //   wormholeInitialSigners,
  //   governanceEmitter,
  //   governanceChainId,
  //   emitterAddresses,
  //   emitterChainIds,
  // } = getDefaultConfig(envOrErr("MIGRATIONS_NETWORK"));

  // console.log("WormholeGovernanceChainId: ", wormholeGovernanceChainId);
  // console.log("WormholeGovernanceContract: ", wormholeGovernanceContract);
  // console.log("WormholeInitialSigners: ", wormholeInitialSigners);
  // console.log("GovernanceEmitter: ", governanceEmitter);
  // console.log("GovernanceChainId: ", governanceChainId);
  // console.log("EmitterAddresses: ", emitterAddresses);
  // console.log("EmitterChainIds: ", emitterChainIds);

  const chainName = envOrErr("MIGRATIONS_NETWORK");
  // const wormholeReceiverChainId = CHAINS[chainName];
  // assert(wormholeReceiverChainId !== undefined);

  // console.log("wormholeReceiverChainId: ", wormholeReceiverChainId);
  // console.log("Chain ID: ", hre.network.config);

  const chain = DefaultStore.chains[chainName];
  if (!chain) {
    throw new Error(`Chain ${chainName} not found`);
  } else if (!(chain instanceof EvmChain)) {
    throw new Error(`Chain ${chainName} is not an EVM chain`);
  }

  const wormholeContract = findWormholeContract(chainName);
  console.log("Wormhole contract: ", wormholeContract);
  if (!wormholeContract) {
    console.log(`Wormhole contract not found for chain ${chainName}`);
    console.log("Deploying Wormhole contract...");
  }
  
  
  // // TODO: Top up accounts if necessary

  // // Deploy Executor contracts
  // const executorImplArtifact = await deployer.loadArtifact(
  //   "ExecutorUpgradable"
  // );
  // // const executorImplContract = await deployer.deploy(executorImplArtifact);
  // // console.log(
  // //   `Deployed ExecutorImplementation on ${executorImplContract.address}`
  // // );

  // // const executorInitData = executorImplContract.interface.encodeFunctionData(
  // //   "initialize",
  // //   [
  // //     wormholeReceiverContract.address,
  // //     0,
  // //     wormholeReceiverChainId,
  // //     governanceChainId,
  // //     governanceEmitter,
  // //   ]
  // // );

  // // Deploy Entropy contracts

  // // const validTimePeriodSeconds = Number(envOrErr("VALID_TIME_PERIOD_SECONDS"));
  // // const singleUpdateFeeInWei = Number(envOrErr("SINGLE_UPDATE_FEE_IN_WEI"));

  // // const pythImplArtifact = await deployer.loadArtifact("PythUpgradable");
  // // const pythProxyArtifact = await deployer.loadArtifact("ERC1967Proxy");

  // // const pythImplContract = await deployer.deploy(pythImplArtifact);

  // // console.log(`Deployed Pyth implementation on ${pythImplContract.address}`);

  // // const pythInitData = pythImplContract.interface.encodeFunctionData(
  // //   "initialize",
  // //   [
  // //     wormholeReceiverContract.address,
  // //     emitterChainIds,
  // //     emitterAddresses,
  // //     governanceChainId,
  // //     governanceEmitter,
  // //     governanceInitialSequence,
  // //     validTimePeriodSeconds,
  // //     singleUpdateFeeInWei,
  // //   ]
  // // );

  // // const pythProxyContract = await deployer.deploy(pythProxyArtifact, [
  // //   pythImplContract.address,
  // //   pythInitData,
  // // ]);

  // // console.log(`Deployed Pyth contract on ${pythProxyContract.address}`);

  // //   const networkId = hre.network.config.chainId;
  // //   const registryPath = `networks/${networkId}.json`;
  // //   console.log(`Saving addresses in ${registryPath}`);
  // //   writeFileSync(
  // //     registryPath,
  // //     JSON.stringify(
  // //       [
  // //         {
  // //           contractName: "WormholeReceiver",
  // //           address: wormholeReceiverContract.address,
  // //         },
  // //         {
  // //           contractName: "PythUpgradable",
  // //           address: pythProxyContract.address,
  // //         },
  // //       ],
  // //       null,
  // //       2
  // //     )
  // //   );
}
