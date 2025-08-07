import { unstable_cache } from "next/cache";
import superjson from "superjson";
import { z } from "zod";

// Your imports
import { Cluster, clients, priceFeedsSchema } from "../services/pyth";

// Backing implementation: NOT exported, never called directly except by cache wrapper
const _getPublishersForFeed = async (cluster: Cluster) => {
  const start = performance.now();
  const data = await clients[cluster].getData();
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] = price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  const end = performance.now();

  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getPublishersForFeed: ${end - start}ms`, result.length);
  return result;
};

// Next.js unstable_cache wrapper; cluster is used as key
export const getPublishersForFeed = unstable_cache(
  _getPublishersForFeed,
[],
  { revalidate: false }
);

const _getFeeds = async (cluster: Cluster) => {
  const start = performance.now();
  const data = await clients[cluster].getData();
const parsedData = priceFeedsSchema.parse(
      data.symbols
        .filter(
          (symbol) =>
            data.productFromSymbol.get(symbol)?.display_symbol !== undefined
        )
        .map((symbol) => ({
          symbol,
          product: data.productFromSymbol.get(symbol),
          price: {
            ...data.productPrice.get(symbol),
            priceComponents:
              data.productPrice
                .get(symbol)
                ?.priceComponents.map(({ publisher }) => ({
                  publisher: publisher.toBase58(),
                })) ?? [],
          },
        }))
    )
  const result = superjson.stringify(
    parsedData
  );

  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getFeeds: ${end - start}ms`, parsedData.length, result.length);
  return result;
};

export const getFeeds = unstable_cache(
  _getFeeds,
 [],
  { revalidate: false }
);

// Now getFeedsCached simply uses the cached version
export const getFeedsCached = async (cluster: Cluster) => {
  const start = performance.now();
  const rawFeeds = await getFeeds(cluster); // uses cache
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getFeedsCached: ${end - start}ms`);
  return superjson.parse<z.infer<typeof priceFeedsSchema>>(rawFeeds);
};

export const getPublishersForFeedCached = async (cluster: Cluster, symbol: string) => {
  const start = performance.now();
  const data = await getPublishersForFeed(cluster); // uses cache
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getPublishersForFeedCached: ${end - start}ms`);
  return data[symbol];
};

export const getFeedsForPublisherCached = async (
  cluster: Cluster,
  publisher: string
) => {
  const start = performance.now();
  const rawFeeds = await getFeeds(cluster); // uses cache
  const feeds = superjson.parse<z.infer<typeof priceFeedsSchema>>(rawFeeds);
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getFeedsForPublisherCached: ${end - start}ms.`);
  return priceFeedsSchema.parse(
    feeds.filter(({ price }) =>
      price.priceComponents.some(
        (component) => component.publisher.toString() === publisher
      )
    )
  );
};
