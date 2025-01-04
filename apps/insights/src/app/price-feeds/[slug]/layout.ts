import type { Metadata } from "next";

import { Cluster, getData } from "../../../services/pyth";
export { PriceFeedLayout as default } from "../../../components/PriceFeed/layout";

export const metadata: Metadata = {
  title: "Price Feeds",
};

export const generateStaticParams = async () => {
  const data = await getData(Cluster.Pythnet);
  return data.map(({ symbol }) => ({ slug: encodeURIComponent(symbol) }));
};
