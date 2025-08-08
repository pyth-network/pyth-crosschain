import { cache } from 'react';
import type { z } from 'zod';

import { Cluster, clients, priceFeedsSchema } from "../services/pyth";
import { createChunkedCacheFetcher, fetchAllChunks } from '../utils/cache';

const getDataCached = cache(async (cluster: Cluster) => {
  return clients[cluster].getData();
});

const fetchFeeds = createChunkedCacheFetcher(async (cluster: Cluster) => {
  const unfilteredData = await getDataCached(cluster);
  const filteredData = unfilteredData.symbols
      .filter(
        (symbol) =>
          unfilteredData.productFromSymbol.get(symbol)?.display_symbol !== undefined
      )
      .map((symbol) => ({
        symbol,
        product: unfilteredData.productFromSymbol.get(symbol),
        price: {
          ...unfilteredData.productPrice.get(symbol),
          priceComponents:
            unfilteredData.productPrice
              .get(symbol)
              ?.priceComponents.map(({ publisher }) => ({
                publisher: publisher.toBase58(),
              })) ?? [],
        },
      }));
  const parsedData = priceFeedsSchema.parse(filteredData);
  return parsedData;
}, 'getfeeds');


const fetchPublishers = createChunkedCacheFetcher(async (cluster: Cluster) => {
  const data = await getDataCached(cluster);
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] = price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  return result;
}, 'getpublishers');

export const getFeedsCached = async (cluster: Cluster) => {
  return fetchAllChunks<z.infer<typeof priceFeedsSchema>, [Cluster]>(fetchFeeds,  cluster)
};

export const getPublishersForFeedCached = async (cluster: Cluster, symbol: string) => {
  const data = await fetchAllChunks<Record<string, string[]>, [Cluster]>(fetchPublishers, cluster);
  return data[symbol]
};

export const getFeedsForPublisherCached = async (
  cluster: Cluster,
  publisher: string
) => {
  const data = await getFeedsCached(cluster); 
  return priceFeedsSchema.parse(
    data.filter(({ price }) =>
      price.priceComponents.some(
        (component) => component.publisher.toString() === publisher
      )
    )
  );
};