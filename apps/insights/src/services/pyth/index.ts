import {
  PythHttpClient,
  PythConnection,
  getPythProgramKeyForCluster,
} from "@pythnetwork/client";
import type { PythPriceCallback } from "@pythnetwork/client/lib/PythConnection";
import { Connection, PublicKey } from "@solana/web3.js";

import { PYTHNET_RPC, PYTHTEST_CONFORMANCE_RPC } from "../../config/isomorphic";

export enum Cluster {
  Pythnet,
  PythtestConformance,
}

export const ClusterToName = {
  [Cluster.Pythnet]: "pythnet",
  [Cluster.PythtestConformance]: "pythtest-conformance",
} as const;

const ClusterToRPC = {
  [Cluster.Pythnet]: PYTHNET_RPC,
  [Cluster.PythtestConformance]: PYTHTEST_CONFORMANCE_RPC,
} as const;

export const CLUSTER_NAMES = ["pythnet", "pythtest-conformance"] as const;

export const toCluster = (name: (typeof CLUSTER_NAMES)[number]): Cluster => {
  switch (name) {
    case "pythnet": {
      return Cluster.Pythnet;
    }
    case "pythtest-conformance": {
      return Cluster.PythtestConformance;
    }
  }
};

export const parseCluster = (name: string): Cluster | undefined =>
  (CLUSTER_NAMES as readonly string[]).includes(name)
    ? toCluster(name as (typeof CLUSTER_NAMES)[number])
    : undefined;

const mkConnection = (cluster: Cluster) =>
  new Connection(ClusterToRPC[cluster]);

const connections = {
  [Cluster.Pythnet]: mkConnection(Cluster.Pythnet),
  [Cluster.PythtestConformance]: mkConnection(Cluster.PythtestConformance),
} as const;

const mkClient = (cluster: Cluster) =>
  new PythHttpClient(
    connections[cluster],
    getPythProgramKeyForCluster(ClusterToName[cluster]),
  );

export const clients = {
  [Cluster.Pythnet]: mkClient(Cluster.Pythnet),
  [Cluster.PythtestConformance]: mkClient(Cluster.PythtestConformance),
} as const;

export const getAssetPricesFromAccounts = (
  cluster: Cluster,
  ...args: Parameters<(typeof clients)[Cluster]["getAssetPricesFromAccounts"]>
) => clients[cluster].getAssetPricesFromAccounts(...args);

export const subscribe = (
  cluster: Cluster,
  feeds: PublicKey[],
  cb: PythPriceCallback,
) => {
  const pythConn = new PythConnection(
    connections[cluster],
    getPythProgramKeyForCluster(ClusterToName[cluster]),
    "confirmed",
    feeds,
  );
  pythConn.onPriceChange(cb);
  return pythConn;
};
