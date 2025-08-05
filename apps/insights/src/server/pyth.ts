import type { PriceData, Product } from '@pythnetwork/client';
import superjson from "superjson";

import { Cluster, clients, getFeeds, priceFeedsSchema } from "../services/pyth";

export const getPublishersForFeed = async (
  cluster: Cluster,
) => {
  "use cache";
  const data = await clients[cluster].getData();
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] = price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  return result;
};

const getAllFeeds = async (cluster: Cluster) => {
  "use cache";
  const data = await clients[cluster].getData();
  return superjson.stringify(data.symbols.filter(
        (symbol) =>
          data.productFromSymbol.get(symbol)?.display_symbol !== undefined,
      ).map((symbol) => ({
        symbol,
        product: data.productFromSymbol.get(symbol),
        price: data.productPrice.get(symbol),
      })))
}

export const getFeedsForPublisherCached = async (
  cluster: Cluster,
  publisher: string,
) => {
  const feeds = superjson.parse<{ symbol: string, product: Product, price: PriceData }[]>(await getAllFeeds(cluster));
  return priceFeedsSchema.parse(feeds.filter(({ price }) =>
    price.priceComponents.some(
      (component) => component.publisher.toString() === publisher,
    ),
  ));
};

export const getFeedsCached = async (cluster: Cluster) => {
  "use cache";
  return getFeeds(cluster);
};

export const getPublishersForFeedCached = async (cluster: Cluster, symbol: string) => {
  const data = await getPublishersForFeed(cluster);
  return data[symbol];
};