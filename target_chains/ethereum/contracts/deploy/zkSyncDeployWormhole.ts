// biome-ignore-all lint/style/noProcessEnv: Deploy script uses env vars for configuration
import type { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import {
  DefaultStore,
  EvmWormholeContract,
} from "@pythnetwork/contract-manager";

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
  _chainName: string,
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

  const receiverSetupContract = await deployer.deploy(receiverSetupArtifact);

  // deploy implementation
  const receiverImplContract = await deployer.deploy(receiverImplArtifact);

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

  return wormholeReceiverContract.address;
}
