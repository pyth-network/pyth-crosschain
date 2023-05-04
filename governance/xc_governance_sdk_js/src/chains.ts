import { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";

export { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";
export const RECEIVER_CHAINS = {
  cronos: 60001,
  kcc: 60002,
  zksync: 60003,
  shimmer: 60004,
  gnosis: 60005,
  evmos: 60006,
  neon: 60007,
  polygon_zkevm: 60008,
  canto: 60009,
  meter: 60010,
  mantle: 60011,
  conflux_espace: 60012,
  sei: 60013,
  osmosis: 60014,
  neutron: 60015,
  // juno: 60016
};

// If there is any overlapping value the receiver chain will replace the wormhole
// value and that is an expected behavior.
export const CHAINS = { ...WORMHOLE_CHAINS, ...RECEIVER_CHAINS };
export declare type ChainName = keyof typeof CHAINS;
export declare type ChainId = typeof CHAINS[ChainName];
