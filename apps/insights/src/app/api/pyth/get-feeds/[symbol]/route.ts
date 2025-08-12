import { stringify } from 'superjson';

import { getFeedsCached } from "../../../../../server/pyth/get-feeds";
import { Cluster } from "../../../../../services/pyth";

export const GET = async (_: Request, { params }: { params: Promise<{ symbol: string }> }) => {
  const { symbol } = await params;

  const feeds = await getFeedsCached(Cluster.Pythnet);
  const feed = feeds.find((feed) => feed.symbol === symbol);
  return new Response(stringify(feed), {
    headers: {
      'Content-Type': 'application/json',
    }
  });
};