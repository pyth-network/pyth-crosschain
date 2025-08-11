import { notFound } from "next/navigation";

import { getFeeds } from "../../server/pyth/get-feeds";
import { Cluster } from "../../services/pyth";

export const getFeed = async (params: Promise<{ slug: string }>) => {
  const [{ slug }, feeds] = await Promise.all([params, getFeeds(Cluster.Pythnet)]);
  const symbol = decodeURIComponent(slug);
  return {
    feeds,
    feed: feeds.find((item) => item.symbol === symbol) ?? notFound(),
    symbol,
  } as const;
};
