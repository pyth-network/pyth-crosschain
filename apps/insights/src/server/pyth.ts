import type { PythHttpClientResult } from '@pythnetwork/client/lib/PythHttpClient';
import type { z } from 'zod';

import { Cluster, clients, priceFeedsSchema } from "../services/pyth";
import { createChunkedCacheFetcher, fetchAllChunks } from '../utils/cache';


type CachedData = {
  data: PythHttpClientResult;
  timestamp: number;
};

const dataCache = new Map<Cluster, CachedData>();
const CACHE_EXPIRY_MS = 24 * 60 * 60; // 1 day in seconds

const getDataCached = async (cluster: Cluster) => {
  const now = Date.now();
  const cached = dataCache.get(cluster);
  
  // Check if cache exists and is not expired
  if (cached && (now - cached.timestamp) < CACHE_EXPIRY_MS * 1000) {
    return cached.data;
  }
  
  // Fetch fresh data
  const data = await clients[cluster].getData();
  dataCache.set(cluster, { data, timestamp: now });
  return data;
};

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
}, 'getFeeds');

const fetchPublishers = createChunkedCacheFetcher(async (cluster: Cluster) => {
  const data = await getDataCached(cluster);
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] = price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  return result;
}, 'getPublishers');

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