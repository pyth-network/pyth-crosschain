import { Network } from "@injectivelabs/networks";
import { NETWORKS } from "../network.js";
import type { InjectiveHost } from "./injective.js";
import type { OsmosisHost } from "./osmosis.js";
import type { TerraHost } from "./terra.js";

export enum CONFIG_TYPE {
  TERRA = "terra",
  INJECTIVE = "injective",
  OSMOSIS = "osmosis",
}

export const CONFIG: Config = {
  [NETWORKS.TERRA_MAINNET]: {
    host: {
      chainID: "phoenix-1",
      name: "mainnet",
      URL: "https://phoenix-lcd.terra.dev",
    },
    type: CONFIG_TYPE.TERRA,
  },
  [NETWORKS.TERRA_TESTNET]: {
    host: {
      chainID: "pisco-1",
      name: "testnet",
      URL: "https://pisco-lcd.terra.dev",
    },
    type: CONFIG_TYPE.TERRA,
  },
  [NETWORKS.TERRA_LOCAL]: {
    host: {
      chainID: "localterra",
      name: "localterra",
      URL: "http://localhost:1317",
    },
    type: CONFIG_TYPE.TERRA,
  },
  [NETWORKS.INJECTIVE_MAINNET]: {
    host: {
      network: Network.Mainnet,
    },
    type: CONFIG_TYPE.INJECTIVE,
  },
  [NETWORKS.INJECTIVE_TESTNET]: {
    host: {
      network: Network.Testnet,
    },
    type: CONFIG_TYPE.INJECTIVE,
  },
  [NETWORKS.OSMOSIS_TESTNET]: {
    host: {
      endpoint: "https://rpc-test.osmosis.zone:443",
    },
    type: CONFIG_TYPE.OSMOSIS,
  },
  [NETWORKS.OSMOSIS_LOCAL]: {
    host: {
      endpoint: "http://localhost:26657",
    },
    type: CONFIG_TYPE.OSMOSIS,
  },
};

export type Config = Record<NETWORKS, NetworkConfig>;

export type NetworkConfig =
  | {
      type: CONFIG_TYPE.TERRA;
      host: TerraHost;
    }
  | {
      type: CONFIG_TYPE.INJECTIVE;
      host: InjectiveHost;
    }
  | {
      type: CONFIG_TYPE.OSMOSIS;
      host: OsmosisHost;
    };
