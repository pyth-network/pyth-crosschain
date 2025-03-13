import {
  DefaultStore,
  EvmChain,
  EvmWormholeContract,
} from "@pythnetwork/contract-manager";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { CHAINS } from "@pythnetwork/xc-admin-common";
import { assert } from "chai";

export function findWormholeContract(chainId: string): string | undefined {
  for (const contract of Object.values(DefaultStore.wormhole_contracts)) {
    if (
      contract instanceof EvmWormholeContract &&
      contract.getChain().getId() === chainId
    ) {
      return contract.address;
    }
  }
}

export async function deployWormholeContract(
  deployer: Deployer,
  chainName: string,
  wormholeGovernanceChainId: string,
  wormholeGovernanceContract: string,
  wormholeInitialSigners: string[],
  wormholeReceiverChainId: number,
): Promise<string> {
  const receiverSetupArtifact = await deployer.loadArtifact("ReceiverSetup");
  const receiverImplArtifact = await deployer.loadArtifact(
    "ReceiverImplementation",
  );
  const wormholeReceiverArtifact =
    await deployer.loadArtifact("WormholeReceiver");
  console.log("Deploying WormholeReceiver contract...");

  const receiverSetupContract = await deployer.deploy(receiverSetupArtifact);
  console.log("Deployed ReceiverSetup on", receiverSetupContract.address);
  console.log("Deploying ReceiverImplementation contract...");

  // deploy implementation
  const receiverImplContract = await deployer.deploy(receiverImplArtifact);
  console.log(
    "Deployed ReceiverImplementation on",
    receiverImplContract.address,
  );

  // encode initialisation data
  const whInitData = receiverSetupContract.interface.encodeFunctionData(
    "setup",
    [
      receiverImplContract.address,
      wormholeInitialSigners,
      wormholeReceiverChainId,
      wormholeGovernanceChainId,
      wormholeGovernanceContract,
    ],
  );

  // deploy proxy
  const wormholeReceiverContract = await deployer.deploy(
    wormholeReceiverArtifact,
    [receiverSetupContract.address, whInitData],
  );

  console.log(
    `Deployed WormholeReceiver on ${wormholeReceiverContract.address}`,
  );

  return wormholeReceiverContract.address;
}
