require("dotenv").config({ path: ".env" });
import { utils, Wallet } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { CHAINS } from "@pythnetwork/xc-admin-common";
import { assert } from "chai";
import { writeFileSync } from "fs";
import {
  deployWormholeContract,
  findWormholeContract,
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

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);

  // Deposit some funds to L2 in order to be able to perform L2 transactions. Uncomment
  // this if the deployment account is unfunded.
  //
  // const depositAmount = ethers.utils.parseEther("0.005");
  // const depositHandle = await deployer.zkWallet.deposit({
  //   to: deployer.zkWallet.address,
  //   token: utils.ETH_ADDRESS,
  //   amount: depositAmount,
  // });
  // // Wait until the deposit is processed on zkSync
  // await depositHandle.wait();

  // Deploy WormholeReceiver contract.

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
    wormholeReceiverContractAddress = await deployWormholeContract(
      deployer,
      chainName,
      wormholeGovernanceChainId,
      wormholeGovernanceContract,
      wormholeInitialSigners,
      wormholeReceiverChainId,
    );
  }

  // Hardcoding the initial sequence number for governance messages.
  const governanceInitialSequence = Number("0");

  const validTimePeriodSeconds = Number(envOrErr("VALID_TIME_PERIOD_SECONDS"));
  const singleUpdateFeeInWei = Number(envOrErr("SINGLE_UPDATE_FEE_IN_WEI"));

  const pythImplArtifact = await deployer.loadArtifact("PythUpgradable");
  const pythProxyArtifact = await deployer.loadArtifact("ERC1967Proxy");

  const pythImplContract = await deployer.deploy(pythImplArtifact);

  console.log(`Deployed Pyth implementation on ${pythImplContract.address}`);

  const pythInitData = pythImplContract.interface.encodeFunctionData(
    "initialize",
    [
      wormholeReceiverContractAddress,
      emitterChainIds,
      emitterAddresses,
      governanceChainId,
      governanceEmitter,
      governanceInitialSequence,
      validTimePeriodSeconds,
      singleUpdateFeeInWei,
    ],
  );

  const pythProxyContract = await deployer.deploy(pythProxyArtifact, [
    pythImplContract.address,
    pythInitData,
  ]);

  console.log(`Deployed Pyth contract on ${pythProxyContract.address}`);

  //   const networkId = hre.network.config.chainId;
  //   const registryPath = `networks/${networkId}.json`;
  //   console.log(`Saving addresses in ${registryPath}`);
  //   writeFileSync(
  //     registryPath,
  //     JSON.stringify(
  //       [
  //         {
  //           contractName: "WormholeReceiver",
  //           address: wormholeReceiverContract.address,
  //         },
  //         {
  //           contractName: "PythUpgradable",
  //           address: pythProxyContract.address,
  //         },
  //       ],
  //       null,
  //       2
  //     )
  //   );
}
