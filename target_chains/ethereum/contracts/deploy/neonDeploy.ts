import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";
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

async function main() {
  // Deploy WormholeReceiver contract.
  const initialSigners = JSON.parse(envOrErr("INIT_SIGNERS"));
  const whGovernanceChainId = envOrErr("INIT_GOV_CHAIN_ID");
  const whGovernanceContract = envOrErr("INIT_GOV_CONTRACT"); // bytes32

  const chainName = envOrErr("WORMHOLE_CHAIN_NAME");
  const wormholeReceiverChainId = CHAINS[chainName];
  assert(wormholeReceiverChainId !== undefined);

  const receiverSetupArtifact = await ethers.getContractFactory(
    "ReceiverSetup"
  );
  const receiverImplArtifact = await ethers.getContractFactory(
    "ReceiverImplementation"
  );
  const wormholeReceiverArtifact = await ethers.getContractFactory(
    "WormholeReceiver"
  );

  console.log("BLOCK: ", await ethers.provider.getBlockNumber());

  const receiverSetupContract = await receiverSetupArtifact.deploy();

  // deploy implementation
  const receiverImplContract = await receiverImplArtifact.deploy();

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
  const wormholeReceiverContract = await wormholeReceiverArtifact.deploy(
    receiverSetupContract.address,
    whInitData
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

  const pythImplArtifact = await ethers.getContractFactory("PythUpgradable");
  const pythProxyArtifact = await ethers.getContractFactory("ERC1967Proxy");

  const pythImplContract = await pythImplArtifact.deploy();

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

  const pythProxyContract = await pythProxyArtifact.deploy([
    pythImplContract.address,
    pythInitData,
  ]);

  console.log(`Deployed Pyth contract on ${pythProxyContract.address}`);

  const networkId = (await ethers.getDefaultProvider().getNetwork()).chainId;
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

main();
