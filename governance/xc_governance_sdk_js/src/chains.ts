import { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";

export { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";
export const RECEIVER_CHAINS = {
  cronos: 60001,
  kcc: 60002,
  zksync: 60003,
};

// If there is any overlapping value the receiver chain will replace the wormhole
// value and that is an expected behavior.
export const CHAINS = { ...WORMHOLE_CHAINS, ...RECEIVER_CHAINS };
export declare type ChainName = keyof typeof CHAINS;
export declare type ChainId = typeof CHAINS[ChainName];
