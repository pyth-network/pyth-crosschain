import { unstable_cache } from "next/cache";
import superjson from "superjson";

const MAX_CACHE_SIZE_STRING = 2 * 1024 * 1024 - 510_000; // buffer size, subtracted some of the nextjs overhead added to each cache entry
const REVALIDATE_TIME = 60 * 60 * 24; // 24 hours


type ChunkedCacheResult = {
  chunk: string;
  chunksNumber: number;
};

type CacheFetcher<Args extends unknown[]> = (...args: [...Args, number?]) => Promise<ChunkedCacheResult>;

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
    async (...argsWithChunk: [...Args, number?]) => {
      const [args, chunk] = (() => {
        if(argsWithChunk.length === 1) {
          return [[argsWithChunk[0]], 0] as [Args, number];
        }
        return [argsWithChunk.slice(0, -1) as Args, argsWithChunk.at(-1) ?? 0] as [Args, number];
      })();

      const fullData = await fetchFullData(...args);
      const serialized = superjson.stringify(fullData);

      // Break into chunks
      const chunksNumber = Math.ceil(serialized.length / MAX_CACHE_SIZE_STRING);
      const chunks = [];
      for (let i = 0; i < chunksNumber; i++) {
        const start = i * MAX_CACHE_SIZE_STRING;
        const end = (i + 1) * MAX_CACHE_SIZE_STRING;
        chunks.push(serialized.slice(start, end));
      }

      return {
        chunk: chunks[chunk] ?? '',
        chunksNumber,
      };
    },
    [key],
    { revalidate: REVALIDATE_TIME }
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
  const firstChunkData = await fetcher(...args, 0);
  const chunksNumber = firstChunkData.chunksNumber;
  if (chunksNumber <= 1) {
    return superjson.parse(firstChunkData.chunk);
  }
  const otherChunks = await Promise.all(
    Array.from({ length: chunksNumber - 1 }, (_, i) => fetcher(...args, i + 1))
  );

  const fullString =
    firstChunkData.chunk + otherChunks.map(({ chunk }) => chunk).join("");
  return superjson.parse(fullString);
}


export const timeFunction = async <T>(fn: () => Promise<T>, name: string) => {
  const start = Date.now();
  const result = await fn();
  const end = Date.now();
  // eslint-disable-next-line no-console
  console.info(`${name} took ${(end - start).toString()}ms`);
  return result;
}