import { parse, } from "superjson";
import { z } from "zod";

import { PUBLIC_URL, VERCEL_AUTOMATION_BYPASS_SECRET } from '../config/server';
import { Cluster, priceFeedsSchema } from "../services/pyth";
import { DEFAULT_CACHE_TTL } from "../utils/cache";

// Convenience helpers matching your previous functions
export async function getPublishersForFeedCached(
  cluster: Cluster,
  symbol: string
) {
  const data = await fetch(`${PUBLIC_URL}/api/pyth/get-publishers/${encodeURIComponent(symbol)}?cluster=${cluster.toString()}`, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: {
      'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET,
    },
  });
  return data.json() as Promise<string[]>;
}

export async function getFeedsForPublisherCached(
  cluster: Cluster,
  publisher: string
) {
  const data = await fetch(`${PUBLIC_URL}/api/pyth/get-feeds-for-publisher/${encodeURIComponent(publisher)}?cluster=${cluster.toString()}`, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: {
      'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET,
    },
  });
  const rawData = await data.text();
  return parse<z.infer<typeof priceFeedsSchema>>(rawData);
}

export const getFeedsCached = async (cluster: Cluster) => {
  const data = await fetch(`${PUBLIC_URL}/api/pyth/get-feeds?cluster=${cluster.toString()}&excludePriceComponents=true`, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: {
      'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET,
    },
  });
  const dataJson = await data.text();
  const feeds: z.infer<typeof priceFeedsSchema> = parse(dataJson);
  return feeds;
}

export const getFeedForSymbolCached = async ({symbol, cluster = Cluster.Pythnet}: {symbol: string, cluster?: Cluster}): Promise<z.infer<typeof priceFeedsSchema>[0] | undefined> => {
  const data = await fetch(`${PUBLIC_URL}/api/pyth/get-feeds/${encodeURIComponent(symbol)}?cluster=${cluster.toString()}`, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: {
      'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET,
    },
  });
  
  if(!data.ok) {
    return undefined;
  }
  const dataJson = await data.text();
  const feed: z.infer<typeof priceFeedsSchema>[0] = parse(dataJson);
  return feed;
}