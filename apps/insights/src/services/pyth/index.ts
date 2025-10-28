import type { PriceData } from "@pythnetwork/client";
import {
  PythHttpClient,
  getPythProgramKeyForCluster,
  parsePriceData,
} from "@pythnetwork/client";
import type { AccountInfo } from "@solana/web3.js";
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
  feed: PublicKey,
  cb: (values: { accountInfo: AccountInfo<Buffer>; data: PriceData }) => void,
) =>
  connections[cluster].onAccountChange(
    feed,
    (accountInfo, context) => {
      cb({
        accountInfo,
        data: parsePriceData(accountInfo.data, context.slot),
      });
    },
    {
      commitment: "confirmed",
    },
  );

export const unsubscribe = (cluster: Cluster, subscriptionId: number) =>
  connections[cluster].removeAccountChangeListener(subscriptionId);
