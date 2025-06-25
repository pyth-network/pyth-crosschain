import evmChainsData from "../../store/chains/EvmChains.json";
import evmPriceFeedContractsData from "../../store/contracts/EvmPriceFeedContracts.json";
import evmWormholeContractsData from "../../store/contracts/EvmWormholeContracts.json";
import * as chains from "viem/chains";

export const getEvmPriceFeedContractAddress = (
  chainId: number,
): `0x${string}` | undefined => {
  const chain = evmChainsData.find((c) => c.networkId === chainId);
  if (!chain) {
    return undefined;
  }
  const contract = evmPriceFeedContractsData.find((c) => c.chain === chain.id);
  if (!contract?.address || !contract.address.startsWith("0x")) {
    return undefined;
  }
  return contract.address as `0x${string}`;
};

export const getEvmWormholeContractAddress = (
  chainId: number,
): `0x${string}` | undefined => {
  const chain = evmChainsData.find((c) => c.networkId === chainId);
  if (!chain) {
    return undefined;
  }
  const contract = evmWormholeContractsData.find((c) => c.chain === chain.id);
  if (!contract?.address || !contract.address.startsWith("0x")) {
    return undefined;
  }
  return contract.address as `0x${string}`;
};

export const getAllEvmChainsIds: number[] = evmChainsData.map(
  (c) => c.networkId,
);

export const getEvmChainRpcUrl = (chainId: number): string | undefined => {
  const chain = evmChainsData.find((c) => c.networkId === chainId);
  if (!chain) {
    return undefined;
  }

  // Let's try to use the viem chains without checking if they are working
  const viemChain = Object.values(chains).find(
    (c) => c.id === Number(chain.id),
  );
  if (viemChain && viemChain.rpcUrls && viemChain.rpcUrls.default) {
    return viemChain.rpcUrls.default.http[0];
  }

  // Now let's try to use the json rpc url
  if (chain.rpcUrl) {
    return chain.rpcUrl;
  }

  return undefined;
};
