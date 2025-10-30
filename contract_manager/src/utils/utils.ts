import * as chains from "viem/chains";

import evmChainsData from "../store/chains/EvmChains.json" with { type: "json" };
import evmPriceFeedContractsData from "../store/contracts/EvmPriceFeedContracts.json" with { type: "json" };
import evmWormholeContractsData from "../store/contracts/EvmWormholeContracts.json" with { type: "json" };

export const allEvmChainIds: number[] = evmChainsData.map((c) => c.networkId);

export const getEvmPriceFeedContractAddress = (
  chainId: number,
): `0x${string}` | undefined => {
  return getContractAddress(chainId, evmPriceFeedContractsData);
};

export const getEvmWormholeContractAddress = (
  chainId: number,
): `0x${string}` | undefined => {
  return getContractAddress(chainId, evmWormholeContractsData);
};

const getContractAddress = (
  chainId: number,
  contractsData: { chain: string; address: string }[],
): `0x${string}` | undefined => {
  const chain = evmChainsData.find((c) => c.networkId === chainId);
  if (chain === undefined) {
    return undefined;
  } else {
    const contract = contractsData.find((c) => c.chain === chain.id);
    if (contract?.address === undefined) {
      return undefined;
    } else if (isZeroXString(contract.address)) {
      return contract.address;
    } else {
      throw new Error(
        `Invariant failed: invalid contract address ${contract.address} for chain ${contract.chain}`,
      );
    }
  }
};

const isZeroXString = (str: string): str is `0x${string}` =>
  str.startsWith("0x") && str.length === 42;

export const getEvmChainRpcUrl = (chainId: number): string | undefined => {
  const chain = evmChainsData.find((c) => c.networkId === chainId);
  if (chain === undefined) {
    return undefined;
  } else {
    const viemChain = Object.values(chains).find(
      (c) => "id" in c && c.id === Number.parseInt(chain.id, 10),
    );
    if (viemChain && "rpcUrls" in viemChain) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return viemChain.rpcUrls.default.http[0] ?? chain.rpcUrl;
    }
    return;
  }
};
