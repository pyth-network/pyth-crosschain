import { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";

const RECEIVER_CHAINS = {
  cronos: 60001,
  kcc: 60002,
  zksync: 60003,
};

export const CHAINS = { ...WORMHOLE_CHAINS, ...RECEIVER_CHAINS };
export declare type ChainName = keyof typeof CHAINS;
export declare type ChainId = typeof CHAINS[ChainName];
