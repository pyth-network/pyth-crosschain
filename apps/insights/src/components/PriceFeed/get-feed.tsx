import { notFound } from "next/navigation";

import { getFeedsCached } from "../../server/pyth";
import { Cluster } from "../../services/pyth";

export const getFeed = async (params: Promise<{ slug: string }>) => {
  const [{ slug }, feeds] = await Promise.all([params, getFeedsCached(Cluster.Pythnet)]);
  const symbol = decodeURIComponent(slug);
  return {
    feeds,
    feed: feeds.find((item) => item.symbol === symbol) ?? notFound(),
    symbol,
  } as const;
};
