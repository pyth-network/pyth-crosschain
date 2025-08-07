import { unstable_cache } from "next/cache";
import { cache } from 'react';
import superjson from "superjson";
import { z } from "zod";

// Your imports
import { Cluster, clients, priceFeedsSchema } from "../services/pyth";

const getDataCached = cache(async (cluster: Cluster) => {
  return clients[cluster].getData();
});
const MAX_CACHE_SIZE_STRING = 2 * 1024 * 1024 - 510_000; // is the buffer for the returned object and the metadata from next

const getPublishersForFeed = unstable_cache(async (cluster: Cluster, chunk?: number) => {
  const data = await getDataCached(cluster);
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] = price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  const stringifiedResult = superjson.stringify(result);

    const chunksNumber = Math.ceil(stringifiedResult.length / MAX_CACHE_SIZE_STRING);
    const chunks = [];
    for(let i = 0; i < chunksNumber; i++) {
      chunks.push(stringifiedResult.slice(i * MAX_CACHE_SIZE_STRING, (i + 1) * MAX_CACHE_SIZE_STRING));
    }
  return {
    chunk: chunks[chunk ?? 0],
    chunksNumber,
  };
}, [], { revalidate: false });

const _getFeeds = unstable_cache(async (cluster: Cluster, chunk?: number) => {
  // eslint-disable-next-line no-console
  console.log('getFeeds', cluster, chunk);
  const data = await getDataCached(cluster);
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
  const chunksNumber = Math.ceil(result.length / MAX_CACHE_SIZE_STRING);
  const chunks = [];
  for(let i = 0; i < chunksNumber; i++) {
    chunks.push(result.slice(i * MAX_CACHE_SIZE_STRING, (i + 1) * MAX_CACHE_SIZE_STRING));
  }
  console.log('size',JSON.stringify({
    chunk: chunks[chunk ?? 0],
    chunksNumber,
  }).length)
  return {
    chunk: chunks[chunk ?? 0],
    chunksNumber,
  };
}, [], { revalidate: false });

export const getFeedsCached = async (cluster: Cluster) => {
  const start = performance.now();
  const { chunk, chunksNumber } = await _getFeeds(cluster); // uses cache
  const rawResults = await Promise.all(Array.from({ length: chunksNumber-1 }, (_, i) => _getFeeds(cluster, i+1)));
  const rawJson = [chunk, ...rawResults.map(({ chunk }) => chunk)].join('');
  const data = superjson.parse<z.infer<typeof priceFeedsSchema>>(rawJson);
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getFeedsCached: ${end - start}ms`);
  return data;
};

export const getPublishersForFeedCached = async (cluster: Cluster, symbol: string) => {
  const start = performance.now();
  const { chunk, chunksNumber } = await getPublishersForFeed(cluster); // uses cache
  const rawResults = await Promise.all(Array.from({ length: chunksNumber-1 }, (_, i) => getPublishersForFeed(cluster, i+1)));
  const rawJson = [chunk, ...rawResults.map(({ chunk }) => chunk)].join('');
  const data = superjson.parse<Record<string, string[]>>(rawJson);
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
  const data = await getFeedsCached(cluster); // uses cache
  const end = performance.now();
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`getFeedsForPublisherCached: ${end - start}ms.`);
  return priceFeedsSchema.parse(
    data.filter(({ price }) =>
      price.priceComponents.some(
        (component) => component.publisher.toString() === publisher
      )
    )
  );
};
