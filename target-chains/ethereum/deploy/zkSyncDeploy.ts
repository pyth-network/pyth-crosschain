import { utils, Wallet } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import loadEnv from "../scripts/loadEnv";
import { CHAINS } from "@pythnetwork/xc-governance-sdk";
import { assert } from "chai";
import { writeFileSync } from "fs";

loadEnv("./");

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
  const initialSigners = JSON.parse(envOrErr("INIT_SIGNERS"));
  const whGovernanceChainId = envOrErr("INIT_GOV_CHAIN_ID");
  const whGovernanceContract = envOrErr("INIT_GOV_CONTRACT"); // bytes32

  const chainName = envOrErr("WORMHOLE_CHAIN_NAME");
  const wormholeReceiverChainId = CHAINS[chainName];
  assert(wormholeReceiverChainId !== undefined);

  const receiverSetupArtifact = await deployer.loadArtifact("ReceiverSetup");
  const receiverImplArtifact = await deployer.loadArtifact(
    "ReceiverImplementation"
  );
  const wormholeReceiverArtifact = await deployer.loadArtifact(
    "WormholeReceiver"
  );

  const receiverSetupContract = await deployer.deploy(receiverSetupArtifact);

  // deploy implementation
  const receiverImplContract = await deployer.deploy(receiverImplArtifact);

  // encode initialisation data
  const whInitData = receiverSetupContract.interface.encodeFunctionData(
    "setup",
    [
      receiverImplContract.address,
      initialSigners,
      wormholeReceiverChainId,
      whGovernanceChainId,
      whGovernanceContract,
    ]
  );

  // deploy proxy
  const wormholeReceiverContract = await deployer.deploy(
    wormholeReceiverArtifact,
    [receiverSetupContract.address, whInitData]
  );

  console.log(
    `Deployed WormholeReceiver on ${wormholeReceiverContract.address}`
  );

  // Deploy Pyth contract.
  const emitterChainIds = [
    envOrErr("SOLANA_CHAIN_ID"),
    envOrErr("PYTHNET_CHAIN_ID"),
  ];
  const emitterAddresses = [
    envOrErr("SOLANA_EMITTER"),
    envOrErr("PYTHNET_EMITTER"),
  ];
  const governanceChainId = envOrErr("GOVERNANCE_CHAIN_ID");
  const governanceEmitter = envOrErr("GOVERNANCE_EMITTER");
  // Default value for this field is 0
  const governanceInitialSequence = Number(
    process.env.GOVERNANCE_INITIAL_SEQUENCE ?? "0"
  );

  const validTimePeriodSeconds = Number(envOrErr("VALID_TIME_PERIOD_SECONDS"));
  const singleUpdateFeeInWei = Number(envOrErr("SINGLE_UPDATE_FEE_IN_WEI"));

  const pythImplArtifact = await deployer.loadArtifact("PythUpgradable");
  const pythProxyArtifact = await deployer.loadArtifact("ERC1967Proxy");

  const pythImplContract = await deployer.deploy(pythImplArtifact);

  const pythInitData = pythImplContract.interface.encodeFunctionData(
    "initialize",
    [
      wormholeReceiverContract.address,
      emitterChainIds,
      emitterAddresses,
      governanceChainId,
      governanceEmitter,
      governanceInitialSequence,
      validTimePeriodSeconds,
      singleUpdateFeeInWei,
    ]
  );

  const pythProxyContract = await deployer.deploy(pythProxyArtifact, [
    pythImplContract.address,
    pythInitData,
  ]);

  console.log(`Deployed Pyth contract on ${pythProxyContract.address}`);

  const networkId = hre.network.config.chainId;
  const registryPath = `networks/${networkId}.json`;
  console.log(`Saving addresses in ${registryPath}`);
  writeFileSync(
    registryPath,
    JSON.stringify(
      [
        {
          contractName: "WormholeReceiver",
          address: wormholeReceiverContract.address,
        },
        {
          contractName: "PythUpgradable",
          address: pythProxyContract.address,
        },
      ],
      null,
      2
    )
  );
}
