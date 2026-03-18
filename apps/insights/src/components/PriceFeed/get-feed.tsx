import { notFound } from "next/navigation";

import { getFeedForSymbolRequest, getFeedsRequest } from "../../server/pyth";
import { Cluster } from "../../services/pyth";

export const getFeed = async (params: Promise<{ slug: string }>) => {
  const feeds = await getFeedsRequest(Cluster.Pythnet);

  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const feed = await getFeedForSymbolRequest({
    cluster: Cluster.Pythnet,
    symbol,
  });

  return {
    feed: feed ?? notFound(),
    feeds,
    symbol,
  } as const;
};
