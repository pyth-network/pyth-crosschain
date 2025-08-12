import { parse } from "superjson";
import { z } from "zod";

import { PUBLIC_URL, VERCEL_AUTOMATION_BYPASS_SECRET } from '../../config/server';
import { Cluster, priceFeedsSchema } from "../../services/pyth";

export const getFeed = async (params: Promise<{ slug: string }>) => {
  const data = await fetch(`${PUBLIC_URL}/api/pyth/get-feeds?cluster=${Cluster.Pythnet.toString()}&excludePriceComponents=true`, {
    next: {
      revalidate: 1000 * 60 * 60 * 24,
    },
    headers: {
      'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET,
    },
  });
  const dataJson = await data.text();
  const feeds: z.infer<typeof priceFeedsSchema> = parse(dataJson);

  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const feed = await fetch(`${PUBLIC_URL}/api/pyth/get-feeds/${encodeURIComponent(symbol)}`, {
    next: {
      revalidate: 1000 * 60 * 60 * 24,
    },
     headers: {
      'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET,
    },
  });
  const feedJson = await feed.text();
  const feedData: z.infer<typeof priceFeedsSchema>[0] = parse(feedJson);

  return {
    feeds,
    feed: feedData,
    symbol,
  } as const;
};
