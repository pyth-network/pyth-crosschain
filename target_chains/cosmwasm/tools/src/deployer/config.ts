import { Network } from "@injectivelabs/networks";
import { TerraHost } from "./terra";
import { InjectiveHost } from "./injective";
import { NETWORKS } from "../network";
import { OsmosisHost } from "./osmosis";

export enum CONFIG_TYPE {
  TERRA = "terra",
  INJECTIVE = "injective",
  OSMOSIS = "osmosis",
}

export const CONFIG: Config = {
  [NETWORKS.TERRA_MAINNET]: {
    type: CONFIG_TYPE.TERRA,
    host: {
      URL: "https://phoenix-lcd.terra.dev",
      chainID: "phoenix-1",
      name: "mainnet",
    },
  },
  [NETWORKS.TERRA_TESTNET]: {
    type: CONFIG_TYPE.TERRA,
    host: {
      URL: "https://pisco-lcd.terra.dev",
      chainID: "pisco-1",
      name: "testnet",
    },
  },
  [NETWORKS.TERRA_LOCAL]: {
    type: CONFIG_TYPE.TERRA,
    host: {
      URL: "http://localhost:1317",
      chainID: "localterra",
      name: "localterra",
    },
  },
  [NETWORKS.INJECTIVE_MAINNET]: {
    type: CONFIG_TYPE.INJECTIVE,
    host: {
      network: Network.Mainnet,
    },
  },
  [NETWORKS.INJECTIVE_TESTNET]: {
    type: CONFIG_TYPE.INJECTIVE,
    host: {
      network: Network.Testnet,
    },
  },
  [NETWORKS.OSMOSIS_TESTNET]: {
    type: CONFIG_TYPE.OSMOSIS,
    host: {
      endpoint: "https://rpc-test.osmosis.zone:443",
    },
  },
  [NETWORKS.OSMOSIS_LOCAL]: {
    type: CONFIG_TYPE.OSMOSIS,
    host: {
      endpoint: "http://localhost:26657",
    },
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
