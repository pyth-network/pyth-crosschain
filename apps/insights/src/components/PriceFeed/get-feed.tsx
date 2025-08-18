import { notFound } from "next/navigation";

import { getFeedForSymbolRequest, getFeedsRequest } from "../../server/pyth";
import { Cluster } from "../../services/pyth";

export const getFeed = async (params: Promise<{ slug: string }>) => {
  const feeds = await getFeedsRequest(Cluster.Pythnet);

  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const feed = await getFeedForSymbolRequest({
    symbol,
    cluster: Cluster.Pythnet,
  });

  return {
    feeds,
    feed: feed ?? notFound(),
    symbol,
  } as const;
};
