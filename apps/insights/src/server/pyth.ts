import type { PythHttpClientResult } from '@pythnetwork/client/lib/PythHttpClient';
import type { z } from 'zod';

import { Cluster, clients, priceFeedsSchema } from "../services/pyth";
import { createChunkedCacheFetcher, fetchAllChunks, timeFunction } from '../utils/cache';


type CacheEntry = {
  data?: PythHttpClientResult;
  timestamp?: number;
  promise?: Promise<PythHttpClientResult>;
};

const dataCache = new Map<Cluster, CacheEntry>();
const CACHE_EXPIRY_MS = 24 * 60 * 60; // 1 day in seconds

const getDataCached = async (cluster: Cluster) => {
  const now = Date.now();
  const cached = dataCache.get(cluster);
  
  // Check if cache exists and is not expired
  if (cached?.data && cached.timestamp && (now - cached.timestamp) < CACHE_EXPIRY_MS * 1000) {
    return cached.data;
  }
  
  // Check if there's already a pending request
  if (cached?.promise) {
    return cached.promise;
  }
  
  // eslint-disable-next-line no-console
  console.log('fetching fresh FULL data');
  
  // Create a new promise for the request
  const promise = clients[cluster].getData().then((data) => {
    // Store the result in cache
    dataCache.set(cluster, { data, timestamp: now });
    return data;
  });
  
  // Store the promise in cache to prevent duplicate requests
  dataCache.set(cluster, { promise });
  
  return promise;
};

const fetchFeeds = createChunkedCacheFetcher(async (cluster: Cluster) => {
  const unfilteredData = await getDataCached(cluster);
  // eslint-disable-next-line no-console
  console.log('fetchFeeds called');
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
  // eslint-disable-next-line no-console
  console.log('fetchPublishers called');
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] = price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  return result;
}, 'fetchPublishers');

export const getFeedsCached = async (cluster: Cluster) => {
  return timeFunction(async () => {
    return fetchAllChunks<z.infer<typeof priceFeedsSchema>, [Cluster]>(fetchFeeds,  cluster);
  }, 'getFeedsCached');
};

export const getPublishersForFeedCached = async (cluster: Cluster, symbol: string) => {
  const data = await timeFunction(async () => {
    return fetchAllChunks<Record<string, string[]>, [Cluster]>(fetchPublishers, cluster);
  }, 'getPublishersForFeedCached');
  return data[symbol]
};

export const getFeedsForPublisherCached = async (
  cluster: Cluster,
  publisher: string
) => {
  const data = await timeFunction(async () => {
    return getFeedsCached(cluster);
  }, 'getFeedsForPublisherCached');
  return priceFeedsSchema.parse(
    data.filter(({ price }) =>
      price.priceComponents.some(
        (component) => component.publisher.toString() === publisher
      )
    )
  );
};