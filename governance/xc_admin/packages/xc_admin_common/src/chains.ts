import { CHAINS as WORMHOLE_CHAINS } from "@certusone/wormhole-sdk";
// GUIDELINES to add a chain
// PYTH will have:
// 1. Mainnet Deployment - which will have pyth mainnet governance and data sources
// 2. Testnet Stable Deployment - which will also have pyth mainnet governance and data sources
// Different chains will have different chain ids i.e., mainnet and testnet will have different chain ids
// to avoid collision of governance messages.

// For evm networks, always add a new chain id, for the other networks If there is already a chain id in wormhole sdk,
// use that for mainnet, and else add a chain id for mainnet too. Also add an id for testnet.
export const RECEIVER_CHAINS = {
  unset: 0, // The global chain id. For messages that are not chain specific.

  // On the following networks we use our own version of Wormhole receiver contract
  ethereum: 2,
  bsc: 4,
  polygon: 5,
  avalanche: 6,
  aurora: 9,
  fantom: 10,
  celo: 14,
  injective: 19,
  arbitrum: 23,
  optimism: 24,

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
  osmosis: 60014,
  sei_pacific_1: 60017,
  neutron: 60019,
  juno: 60020,
  kava: 60022,
  wemix: 60023,
  linea: 60024,
  eos: 60026,
  syndr: 60027,
  scroll: 60028,
  ronin: 60029,
  horizen_eon: 60030,
  boba: 60031,
  manta: 60032,
  chiliz: 60033,
  zetachain: 60034,
  astar_zkevm: 60035,
  coredao: 60036,
  tomochain: 60037,
  stacks: 60038,
  mode: 60039,
  bttc: 60040,
  zkfair: 60041,
  hedera: 60042,
  filecoin: 60043,
  lightlink_phoenix: 60044,
  injective_inevm: 60045,
  blast: 60046,
  merlin: 60047,
  parallel: 60048,

  // Testnets as a separate chain ids (to use stable data sources and governance for them)
  injective_testnet: 60013,
  osmosis_testnet_4: 60015,
  osmosis_testnet_5: 60016,
  sei_testnet_atlantic_2: 60018,
  juno_testnet: 60021,
  neutron_testnet_pion_1: 60025,

  linea_goerli: 50001,
  fuji: 50002, // Avalanche testnet
  base_goerli: 50003,
  cronos_testnet: 50004,
  zksync_goerli: 50005,
  canto_testnet: 50006,
  polygon_zkevm_testnet: 50007,
  aurora_testnet: 50008,
  mantle_sepolia: 50009,
  fantom_testnet: 50010,
  mumbai: 50011, // Polygon testnet
  neon_devnet: 50012,
  chiado: 50013, // Gnosis testnet
  kava_testnet: 50014,
  evmos_testnet: 50015,
  bsc_testnet: 50016,
  conflux_espace_testnet: 50017,
  optimism_goerli: 50018,
  wemix_testnet: 50019,
  celo_alfajores_testnet: 50020,
  syndr_nitro_testnet: 50021,
  kcc_testnet: 50022,
  eos_testnet: 50023,
  meter_testnet: 50024,
  shimmer_testnet: 50025,
  scroll_sepolia: 50026,
  saigon: 50027, // Ronin testnet
  horizen_gobi: 50028,
  sepolia: 50029, // Ethereum latest testnet
  arbitrum_sepolia: 50030, // Arbitrum latest testnet
  boba_goerli: 50031,
  manta_testnet: 50032,
  optimism_sepolia: 50033,
  chiliz_spicy: 50034, // Chiliz testnet
  zetachain_testnet: 50035,
  astar_zkevm_testnet: 50036,
  coredao_testnet: 50037,
  tomochain_testnet: 50038,
  stacks_testnet: 50039,
  mode_testnet: 50040,
  bttc_testnet: 50041,
  zksync_sepolia: 50042,
  base_sepolia: 50043,
  movement_evm_devnet: 50044,
  movement_move_devnet: 50045,
  zkfair_testnet: 50046,
  blast_s2_testnet: 50047,
  hedera_testnet: 50048,
  filecoin_calibration: 50049, // Filecoin testnet
  lightlink_pegasus_testnet: 50050,
  sei_evm_devnet: 50051,
  fantom_sonic_testnet: 50052,
  dela_deperp_testnet: 50053,
  injective_inevm_testnet: 50054,
  idex_xchain_testnet: 50055,
  berachain_testnet: 50056,
  merlin_testnet: 50057,
  manta_sepolia: 50058,
  polygon_blackberry: 50059, // Gelato shared testnet
  arbitrum_blueberry: 50060, // Gelato shared testnet
  optimism_celestia_raspberry: 50061, // Gelato shared testnet
  parallel_testnet: 50062,
  polynomial_testnet: 50063,
  linea_sepolia: 50064,
  rol_testnet: 50065,
  merlin_testnet_v2: 50066,
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
