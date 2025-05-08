import {
  PythHttpClient,
  PythConnection,
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
} from "@pythnetwork/client";
import type { PythPriceCallback } from "@pythnetwork/client/lib/PythConnection";
import { Connection, PublicKey } from "@solana/web3.js";
import { z } from "zod";

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

export const parseCluster = (name: string): Cluster | undefined =>
  (CLUSTER_NAMES as readonly string[]).includes(name)
    ? toCluster(name as (typeof CLUSTER_NAMES)[number])
    : undefined;

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

export const getPublishersForFeed = async (
  cluster: Cluster,
  symbol: string,
) => {
  const data = await clients[cluster].getData();
  return data.productPrice
    .get(symbol)
    ?.priceComponents.map(({ publisher }) => publisher.toBase58());
};

export const getFeeds = async (cluster: Cluster) => {
  const data = await clients[cluster].getData();
  return priceFeedsSchema.parse(
    data.symbols.map((symbol) => ({
      symbol,
      product: data.productFromSymbol.get(symbol),
      price: data.productPrice.get(symbol),
    })),
  );
};

export const getFeedsForPublisher = async (
  cluster: Cluster,
  publisher: string,
) => {
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
      }))
      .filter(({ price }) =>
        price?.priceComponents.some(
          (component) => component.publisher.toBase58() === publisher,
        ),
      ),
  );
};

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
    }),
  }),
);

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
