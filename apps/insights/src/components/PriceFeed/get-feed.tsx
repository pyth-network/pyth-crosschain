import { parse } from "superjson";
import { z } from "zod";

import { PUBLIC_URL, VERCEL_AUTOMATION_BYPASS_SECRET } from '../../config/server';
import { getFeedForSymbolCached } from '../../server/pyth';
import { Cluster, priceFeedsSchema } from "../../services/pyth";
import { DEFAULT_CACHE_TTL } from '../../utils/cache';

export const getFeed = async (params: Promise<{ slug: string }>) => {
  const data = await fetch(`${PUBLIC_URL}/api/pyth/get-feeds?cluster=${Cluster.Pythnet.toString()}&excludePriceComponents=true`, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: {
      'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET,
    },
  });
  const dataJson = await data.text();
  const feeds: z.infer<typeof priceFeedsSchema> = parse(dataJson);

  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const feed = await getFeedForSymbolCached({symbol, cluster: Cluster.Pythnet});

  return {
    feeds,
    feed,
    symbol,
  } as const;
};
