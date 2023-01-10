import { Network } from "@injectivelabs/networks";
import { TerraHost } from "./terra";
import { InjectiveHost } from "./injective";
import { NETWORKS } from "../network";

export enum CONFIG_TYPE {
  TERRA = "terra",
  INJECTIVE = "injective",
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
  [NETWORKS.INJECTIVE_TESTNET]: {
    type: CONFIG_TYPE.INJECTIVE,
    host: {
      network: Network.Testnet,
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
    };
