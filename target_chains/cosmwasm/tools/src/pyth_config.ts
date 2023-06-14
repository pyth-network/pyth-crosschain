import { NETWORKS } from "./network";

const PYTH_SOURCES_TESTNET = {
  data_sources: [
    {
      emitter: Buffer.from(
        "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0",
        "hex"
      ).toString("base64"),
      chain_id: 1,
    },
    {
      emitter: Buffer.from(
        "a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6",
        "hex"
      ).toString("base64"),
      chain_id: 26,
    },
  ],
  governance_source: {
    emitter: Buffer.from(
      "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
      "hex"
    ).toString("base64"),
    chain_id: 1,
  },
};

const PYTH_SOURCES_MAINNET = {
  data_sources: [
    {
      emitter: Buffer.from(
        "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
        "hex"
      ).toString("base64"),
      chain_id: 1,
    },
    {
      emitter: Buffer.from(
        "f8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0",
        "hex"
      ).toString("base64"),
      chain_id: 26,
    },
  ],
  governance_source: {
    emitter: Buffer.from(
      "5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e",
      "hex"
    ).toString("base64"),
    chain_id: 1,
  },
};

export type PythConfig = {
  wormhole_contract: string;
  data_sources: DataSource[];
  governance_source: DataSource;
  governance_source_index: number;
  governance_sequence_number: number;
  chain_id: number;
  valid_time_period_secs: number;
  fee: Fee;
};

export type DataSource = {
  emitter: string;
  chain_id: number;
};

export type Fee = {
  amount: string;
  denom: string;
};

type Config = Record<NETWORKS, PythConfig>;

export const CONFIG: Config = {
  [NETWORKS.TERRA_MAINNET]: {
    wormhole_contract:
      "terra12mrnzvhx3rpej6843uge2yyfppfyd3u9c3uq223q8sl48huz9juqffcnh",
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 18,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "uluna",
    },
    ...PYTH_SOURCES_MAINNET,
  },
  [NETWORKS.TERRA_TESTNET]: {
    wormhole_contract:
      "terra19nv3xr5lrmmr7egvrk2kqgw4kcn43xrtd5g0mpgwwvhetusk4k7s66jyv0",
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 18,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "uluna",
    },
    ...PYTH_SOURCES_TESTNET,
  },
  [NETWORKS.TERRA_LOCAL]: {
    // random contract for local testing
    wormhole_contract:
      "terra19nv3xr5lrmmr7egvrk2kqgw4kcn43xrtd5g0mpgwwvhetusk4k7s66jyv0",
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 18,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "uluna",
    },
    // invalid contract info for local testing
    ...PYTH_SOURCES_TESTNET,
  },
  [NETWORKS.INJECTIVE_MAINNET]: {
    wormhole_contract: "inj17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9l2q74d",
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 19,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "inj",
    },
    ...PYTH_SOURCES_MAINNET,
  },
  [NETWORKS.INJECTIVE_TESTNET]: {
    wormhole_contract: "inj1xx3aupmgv3ce537c0yce8zzd3sz567syuyedpg",
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 19,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "inj",
    },
    ...PYTH_SOURCES_TESTNET,
  },
  [NETWORKS.OSMOSIS_TESTNET]: {
    wormhole_contract:
      "osmo1hggkxr0hpw83f8vuft7ruvmmamsxmwk2hzz6nytdkzyup9krt0dq27sgyx",
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 20,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "uosmo",
    },
    ...PYTH_SOURCES_TESTNET,
  },
  [NETWORKS.OSMOSIS_TESTNET_5]: {
    wormhole_contract:
      "osmo1hggkxr0hpw83f8vuft7ruvmmamsxmwk2hzz6nytdkzyup9krt0dq27sgyx",
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 20,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "uosmo",
    },
    ...PYTH_SOURCES_TESTNET,
  },
  // this details below are invalid and random
  // they are to be used only for for testing purposes
  [NETWORKS.OSMOSIS_LOCAL]: {
    // random wormhole contract
    wormhole_contract:
      "osmo1mypljhatv0prfr9cjzzvamxdf2ctg34xkt50sudxads9zhqnyneqjuvy26",
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 19,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "uosmo",
    },
    // these are same as testnet but are being used in LocalOsmosis (local blockchain)
    // used only for development and testing purposes
    ...PYTH_SOURCES_TESTNET,
  },
};
