import { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";
// GUIDELINES to add a chain
// PYTH will have:
// 1. Mainnet Deployment - which will have pyth mainnet governance and data sources
// 2. Testnet Stable Deployment - which will also have pyth mainnet governance and data sources
// Different chains will have different chain ids i.e., mainnet and testnet will have different chain ids
// to avoid collision of governance messages.

// For evm networks, always add a new chain id, for the other networks If there is already a chain id in wormhole sdk,
// use that for mainnet, and else add a chain id for mainnet too. Also add an id for testnet.
import receiverChainsJson from "./receiver_chains.json";

// If there is any overlapping value the receiver chain will replace the wormhole
// value and that is an expected behavior.
export const CHAINS = {
  ...WORMHOLE_CHAINS,
  ...receiverChainsJson.mainnet,
  ...receiverChainsJson.non_mainnet,
};
export declare type ChainName = keyof typeof CHAINS;
export declare type ChainId = typeof CHAINS[ChainName];

export function toChainId(chainName: ChainName): ChainId {
  return CHAINS[chainName];
}

const CHAIN_ID_TO_NAME: Record<number, ChainName> = Object.entries(
  CHAINS
).reduce((obj, [name, id]) => {
  obj[id as number] = name as ChainName;
  return obj;
}, {} as Record<number, ChainName>);

export function toChainName(chainId: ChainId): ChainName {
  return CHAIN_ID_TO_NAME[chainId];
}
