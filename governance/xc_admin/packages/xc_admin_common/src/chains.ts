import { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";
// GUIDELINES to add a chain
// PYTH will have:
// 1. Mainnet Deployment - which will have pyth mainnet governance and data sources
// 2. Testnet Stable Deployment - which will also have pyth mainnet governance and data sources
// 3. Testnet Edge Deployment - which will have pyth testnet governance and data sources.
// Different chains will have different chain ids i.e., mainnet and testnet will have different chain ids.
// Though stable and edge contracts on testnet will share the same chain id. They are governed by different
// sources hence there is no chance of collision.

// If there is already a chain id in wormhole sdk. Use that for Mainnet
// Else add a chain id for mainnet too.
// Add an id for the testnet
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
  injective_testnet: 60013,
  osmosis: 60014,
  osmosis_testnet_4: 60015,
  osmosis_testnet_5: 60016,
  sei_pacific_1: 60017,
  sei_testnet_atlantic_2: 60018,
  neutron: 60019,
  juno: 60020,
  juno_testnet: 60021,
  kava: 60022,
  wemix: 60023,
  linea: 60024,
  neutron_testnet_pion_1: 60025,
  eos: 60026,
  syndr: 60027,
  scroll: 60028,
  ronin: 60029,
  horizen: 60030,
  boba: 60031,
  manta: 60032,
  chiliz: 60033,
  zetachain: 60034,
  astar: 60035,
};

// If there is any overlapping value the receiver chain will replace the wormhole
// value and that is an expected behavior.
export const CHAINS = { ...WORMHOLE_CHAINS, ...RECEIVER_CHAINS };
export declare type ChainName = keyof typeof CHAINS;
export declare type ChainId = typeof CHAINS[ChainName];

export function toChainId(chainName: ChainName): ChainId {
  return CHAINS[chainName];
}

const CHAIN_ID_TO_NAME = Object.entries(CHAINS).reduce((obj, [name, id]) => {
  obj[id] = name;
  return obj;
}, {} as any);

export function toChainName(chainId: ChainId): ChainName {
  return CHAIN_ID_TO_NAME[chainId];
}
