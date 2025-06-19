import * as EvmChains from "@pythnetwork/contract-manager/data/chains/EvmChains.json";
import * as EvmPriceFeedContracts from "@pythnetwork/contract-manager/data/contracts/EvmPriceFeedContracts.json";

type EvmChains = {
  id: string;
  mainnet: boolean;
  rpcUrl: string;
  networkId: number;
  type: string;
  nativeToken?: string;
};

const getPriceFeedContractAddress = (chain: EvmChains) => {
  const contractAddress = Object.values(EvmPriceFeedContracts).find(
    (contract) => contract.chain === chain.id,
  );
  return contractAddress?.address as `0x${string}`;
};

const mapEvmChainsToNetworkInfo = (chains: EvmChains[]) => {
  const networkInfo: Record<number, NetworkInfo> = {};

  for (const chain of chains) {
    const id = Number(chain.networkId);
    networkInfo[id] = {
      name: chain.id,
      rpcUrl: chain.rpcUrl,
      isMainnet: chain.mainnet,
      contractAddress: getPriceFeedContractAddress(chain),
    };
  }

  return networkInfo;
};

// Convert EvmChains to array format
const evmChainsArray = Object.values(EvmChains) as EvmChains[];
export const NETWORK_INFO = mapEvmChainsToNetworkInfo(evmChainsArray);

export const getContractAddress = (networkId: number) =>
  isSupportedNetwork(networkId)
    ? NETWORK_INFO[networkId]?.contractAddress
    : undefined;

const isSupportedNetwork = (
  networkId: number,
): networkId is keyof typeof NETWORK_INFO => networkId in NETWORK_INFO;

type NetworkInfo = {
  name: string;
  rpcUrl: string;
  isMainnet: boolean;
  contractAddress: `0x${string}`;
};

export const getRpcUrl = (networkId: number) =>
  isSupportedNetwork(networkId) ? NETWORK_INFO[networkId]?.rpcUrl : undefined;

export const NETWORK_IDS = Object.keys(NETWORK_INFO).map((key) =>
  Number.parseInt(key, 10),
);
