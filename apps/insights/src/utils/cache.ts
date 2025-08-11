import type { Cache as ACDCache } from "async-cache-dedupe";
import { createCache } from "async-cache-dedupe";
import { unstable_cache } from "next/cache";
import { stringify, parse } from "superjson";

import { getRedis } from '../config/server';

type CacheFetcher<Args extends unknown[]> = (...args: Args) => Promise<string>;

/**
 * Wraps an async function that returns data of type T, and caches it in chunks.
 * @param keyCacheBase - base cache key prefix
 * @param fetchFullData - async function returning the full data T for given args except chunk number
 * @returns a new async function that fetches chunked cached data with the same args plus optional chunk number
 */
export function createChunkedCacheFetcher<T, Args extends unknown[]>(
  fetchFullData: (...args: Args) => Promise<T>,
  key: string,
): CacheFetcher<Args> {
  return unstable_cache(
    async (...args: Args) => {
      const fullData = await fetchFullData(...args);
      const serialized = stringify(fullData);


      return serialized;
    },
    [key],
    { revalidate: false }
  );
}

/**
 * Utility function to fetch all chunks and combine them transparently
 * @param fetcher - cached fetcher returned by createChunkedCacheFetcher
 * @param args - args to the cached fetcher except chunk number
 */
export async function fetchAllChunks<T, Args extends unknown[]>(
  fetcher: CacheFetcher<Args>,
  ...args: Args
): Promise<T> {
  const firstChunkData = await fetcher(...args);

  const fullString = firstChunkData;
  return parse(fullString);
}


export const timeFunction = async <T>(fn: () => Promise<T>, name: string) => {
  const start = Date.now();
  const result = await fn();
  const end = Date.now();
  // eslint-disable-next-line no-console
  console.info(`${name} took ${(end - start).toString()}ms`);
  return result;
}


// L2-backed cache: in-memory LRU (L1) + Redis (L2)
export const redisCache: ACDCache = createCache({
  storage: {
    type: "redis",
    options: {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      client: await getRedis(),
    },
  },
});

export const memoryOnlyCache: ACDCache = createCache({
  ttl: 5000,
  stale: 2000,
});