import {
  PythHttpClient,
  PythConnection,
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
} from "@pythnetwork/client";
import type { PythPriceCallback } from "@pythnetwork/client/lib/PythConnection";
import { Connection, PublicKey } from "@solana/web3.js";
import { z } from "zod";

import { cache } from "../cache";

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;

export enum Cluster {
  Pythnet,
  PythtestConformance,
}

export const ClusterToName = {
  [Cluster.Pythnet]: "pythnet",
  [Cluster.PythtestConformance]: "pythtest-conformance",
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

const mkConnection = (cluster: Cluster) =>
  new Connection(getPythClusterApiUrl(ClusterToName[cluster]));

const connections = {
  [Cluster.Pythnet]: mkConnection(Cluster.Pythnet),
  [Cluster.PythtestConformance]: mkConnection(Cluster.PythtestConformance),
} as const;

const mkClient = (cluster: Cluster) =>
  new PythHttpClient(
    connections[cluster],
    getPythProgramKeyForCluster(ClusterToName[cluster]),
  );

const clients = {
  [Cluster.Pythnet]: mkClient(Cluster.Pythnet),
  [Cluster.PythtestConformance]: mkClient(Cluster.PythtestConformance),
} as const;

export const getData = cache(
  async (cluster: Cluster) => {
    const data = await clients[cluster].getData();
    return priceFeedsSchema.parse(
      data.symbols
        .filter(
          (symbol) =>
            data.productFromSymbol.get(symbol)?.display_symbol !== undefined,
        )
        .map((symbol) => ({
          symbol,
          product: data.productFromSymbol.get(symbol),
          price: data.productPrice.get(symbol),
        })),
    );
  },
  ["pyth-data"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

const priceFeedsSchema = z.array(
  z.object({
    symbol: z.string(),
    product: z.object({
      display_symbol: z.string(),
      asset_type: z.string(),
      description: z.string(),
      price_account: z.string(),
      base: z.string().optional(),
      country: z.string().optional(),
      quote_currency: z.string().optional(),
      tenor: z.string().optional(),
      cms_symbol: z.string().optional(),
      cqs_symbol: z.string().optional(),
      nasdaq_symbol: z.string().optional(),
      generic_symbol: z.string().optional(),
      weekly_schedule: z.string().optional(),
      schedule: z.string().optional(),
      contract_id: z.string().optional(),
    }),
    price: z.object({
      exponent: z.number(),
      numComponentPrices: z.number(),
      numQuoters: z.number(),
      minPublishers: z.number(),
      lastSlot: z.bigint(),
      validSlot: z.bigint(),
      priceComponents: z.array(
        z.object({
          publisher: z.instanceof(PublicKey).transform((key) => key.toBase58()),
        }),
      ),
    }),
  }),
);

export const getTotalFeedCount = async (cluster: Cluster) => {
  const pythData = await getData(cluster);
  return pythData.filter(({ price }) => price.numComponentPrices > 0).length;
};

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
