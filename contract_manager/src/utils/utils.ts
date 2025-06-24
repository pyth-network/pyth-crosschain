import Web3 from 'web3';
import evmChainsData from '../../store/chains/EvmChains.json';
import evmPriceFeedContractsData from '../../store/contracts/EvmPriceFeedContracts.json';
import evmWormholeContractsData from '../../store/contracts/EvmWormholeContracts.json';
import * as chains from "viem/chains";

export const getEvmContractAddress = (chainId: number, contractType: string): `0x${string}` => {
  const chain = evmChainsData.find((c) => c.networkId === chainId);
  if (!chain) {
    throw new Error(`Chain with network ID ${chainId} not found`);
  }
  
  if (contractType === 'priceFeed') {
    const contract = evmPriceFeedContractsData.find((c) => c.chain === chain.id);
    if (!contract) {
      throw new Error(`Price feed contract not found for chain ${chainId}`);
    }
    return contract.address as `0x${string}`;
  }
  
  if (contractType === 'wormhole') {
    const contract = evmWormholeContractsData.find((c) => c.chain === chain.id);
    if (!contract) {
      throw new Error(`Wormhole contract not found for chain ${chainId}`);
    }
    return contract.address as `0x${string}`;
  }
  
  throw new Error(`Unknown contract type: ${contractType}`);
}

export const getAllEvmChainsIds = () => evmChainsData.map((c) => c.networkId);


// TODO: The below method should be used to get the RPC URL for a chain, but it is not working as expecte
// export const getEvmChainRpcUrl = async (chainId: number) => {
//   const chain = evmChainsData.find((c) => c.networkId === chainId);
//   if (!chain) {
//     throw new Error(`Chain with network ID ${chainId} not found`);
//   }
  
//   // Try JSON RPC URL first
//   if (await checkRpcUrl(chain.rpcUrl)) {
//     return chain.rpcUrl;
//   }
  
//   // Fallback to viem chains
//   const viemChain = Object.values(chains).find((c: any) => c.id === chain.id);
//   if (viemChain && viemChain.rpcUrls && viemChain.rpcUrls.default) {
//     const viemRpcUrl = viemChain.rpcUrls.default.http[0];
//     if (await checkRpcUrl(viemRpcUrl)) {
//       return viemRpcUrl;
//     }
//   }
  
//   throw new Error(`No working RPC URL found for chain ${chainId}`);
// }


export const getEvmChainRpcUrl = (chainId: number) => {
  const chain = evmChainsData.find((c) => c.networkId === chainId);
  if (!chain) {
    throw new Error(`Chain with network ID ${chainId} not found`);
  }
  
  
  // Let's try to use the viem chains without checking if they are working
  const viemChain = Object.values(chains).find((c: any) => c.id === chain.id);
  if (viemChain && viemChain.rpcUrls && viemChain.rpcUrls.default) {
    const viemRpcUrl = viemChain.rpcUrls.default.http[0];
    return viemRpcUrl;
  } 

  // Now let's try to use the json rpc url
  if (chain.rpcUrl) {
    return chain.rpcUrl;
  }
  
  throw new Error(`No working RPC URL found for chain ${chainId}`);
}


// const checkRpcUrl = (rpcUrl: string) => {
//   const web3 = new Web3(rpcUrl);
//   return web3.eth.getBlockNumber().then((blockNumber) => {
//     return true;
//   }).catch((error) => {
//     console.error(`Error checking RPC URL ${rpcUrl}: ${error}`);
//     return false;
//   });
// }