import { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";

export { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";
// GUIDELINES to add a chain
// PYTH will have:
// 1. Mainnet Deployment - which will have pyth mainnet governance and data sources
// 2. Testnet Stable Deployment - which will also have pyth mainnet governance and data sources
// 3. Testnet Edge Deployment - which will have pyth testnet governance and data sources.
// Mainnet Deployment and Testnet Edge deployment can have the same chain id.
// Testnet Stable Deployment must have an id separate from Mainnet Deployment. Or else the VAAs
// for Testnet Stable Deployment are executable on Mainnet Deploymnent.
//
// If there is already a chain id in wormhole sdk. Use that for Mainnet and Testnet Edge
// Else add a chain id for these two eg. juno 60016
// For Testnet Stable Deployment add an id that is different to the above mentioned chain id.
// eg. juno_stable: 60019
// Currently we are deploying this for cosmos chains only. But this will be for all the chains in future.
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

  // for cosmos
  sei: 60013,
  sei_stable: 60014,
  osmosis: 60015,
  osmosis_stable: 60016,
  neutron: 60017,
  neutron_stable: 60018,
  juno: 60019,
  juno_stable: 60020,
};

// If there is any overlapping value the receiver chain will replace the wormhole
// value and that is an expected behavior.
export const CHAINS = { ...WORMHOLE_CHAINS, ...RECEIVER_CHAINS };
export declare type ChainName = keyof typeof CHAINS;
export declare type ChainId = typeof CHAINS[ChainName];
