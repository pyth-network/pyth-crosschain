import { notFound } from "next/navigation";

import { Cluster, getFeeds } from "../../services/pyth";

export const getFeed = async (params: Promise<{ slug: string }>) => {
  "use cache";

  const [{ slug }, feeds] = await Promise.all([params, getPythnetFeeds()]);
  const symbol = decodeURIComponent(slug);
  return {
    feeds,
    feed: feeds.find((item) => item.symbol === symbol) ?? notFound(),
    symbol,
  } as const;
};

const getPythnetFeeds = async () => {
  "use cache";
  return getFeeds(Cluster.Pythnet);
};
