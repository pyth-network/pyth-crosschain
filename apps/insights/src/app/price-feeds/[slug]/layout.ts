import type { Metadata } from "next";

import { Cluster, getFeeds } from "../../../services/pyth";
export { PriceFeedLayout as default } from "../../../components/PriceFeed/layout";

export const metadata: Metadata = {
  title: "Price Feeds",
};

export const generateStaticParams = async () => {
  const feeds = await getFeeds(Cluster.Pythnet);
  return feeds.map(({ symbol }) => ({ slug: encodeURIComponent(symbol) }));
};
