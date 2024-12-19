import { unstable_cache } from "next/cache";
import { parse, stringify } from "superjson";

export const cache = <T, P extends unknown[]>(
  fn: (...params: P) => Promise<T>,
  keys?: Parameters<typeof unstable_cache>[1],
  opts?: Parameters<typeof unstable_cache>[2],
) => {
  const cachedFn = unstable_cache(
    async (params: P): Promise<string> => stringify(await fn(...params)),
    keys,
    opts,
  );

  return async (...params: P): Promise<T> => parse(await cachedFn(params));
};
