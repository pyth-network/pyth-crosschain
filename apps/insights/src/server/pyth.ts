import superjson from "superjson";
import { z } from 'zod';

import { Cluster, clients, priceFeedsSchema } from "../services/pyth";

export const getPublishersForFeed = async (
  cluster: Cluster,
) => {
  "use cache";
  const start = performance.now();
  const data = await clients[cluster].getData();
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] = price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getPublishersForFeed: ${end - start}ms`);
  return result;
};

const getFeeds = async (cluster: Cluster) => {
  "use cache";
  const start = performance.now();
  const data = await clients[cluster].getData();
  
  const result = superjson.stringify(priceFeedsSchema.parse(data.symbols.filter(
        (symbol) =>
          data.productFromSymbol.get(symbol)?.display_symbol !== undefined,
      ).map((symbol) => ({
        symbol,
        product: data.productFromSymbol.get(symbol),
        price: {
          ...data.productPrice.get(symbol),
          priceComponents: data.productPrice.get(symbol)?.priceComponents.map(({ publisher }) => ({
            publisher: publisher.toBase58(),
          })) ?? [],
        },
      }))))
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getFeeds: ${end - start}ms`);
  return result;
}

export const getFeedsForPublisherCached = async (
  cluster: Cluster,
  publisher: string,
) => {
  const start = performance.now();
  const rawFeeds = await getFeeds(cluster);
  const feeds = superjson.parse<z.infer<typeof priceFeedsSchema>>(rawFeeds);
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getFeedsForPublisherCached: ${end - start}ms`);
  return priceFeedsSchema.parse(feeds.filter(({ price }) =>
    price.priceComponents.some(
      (component) => component.publisher.toString() === publisher,
    ),
  ));
};

export const getFeedsCached = async (cluster: Cluster) => {
  "use cache";
  const start = performance.now();
  const rawFeeds = await getFeeds(cluster);
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getFeedsCached: ${end - start}ms`);
  return superjson.parse<z.infer<typeof priceFeedsSchema>>(rawFeeds);
};

export const getPublishersForFeedCached = async (cluster: Cluster, symbol: string) => {
  const start = performance.now();
  const data = await getPublishersForFeed(cluster);
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getPublishersForFeedCached: ${end - start}ms`);
  return data[symbol];
};