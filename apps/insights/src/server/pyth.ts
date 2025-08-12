import { parse, } from "superjson";
import { z } from "zod";

import { PUBLIC_URL, VERCEL_AUTOMATION_BYPASS_SECRET } from '../config/server';
import { Cluster, priceFeedsSchema } from "../services/pyth";

// Convenience helpers matching your previous functions
export async function getPublishersForFeedCached(
  cluster: Cluster,
  symbol: string
) {
  const data = await fetch(`${PUBLIC_URL}/api/pyth/get-publishers/${encodeURIComponent(symbol)}?cluster=${cluster.toString()}`, {
    next: {
      revalidate: 1000 * 60 * 60 * 24,
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
      revalidate: 1000 * 60 * 60 * 24,
    },
    headers: {
      'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET,
    },
  });
  const rawData = await data.text();
  return parse<z.infer<typeof priceFeedsSchema>>(rawData);
}