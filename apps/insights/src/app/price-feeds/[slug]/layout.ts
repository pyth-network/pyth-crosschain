import type { Metadata } from "next";

import { getData } from "../../../services/pyth";
export { PriceFeedLayout as default } from "../../../components/PriceFeed/layout";

export const metadata: Metadata = {
  title: "Price Feeds",
};

export const generateStaticParams = async () => {
  const data = await getData();
  return data.map(({ symbol }) => ({ slug: encodeURIComponent(symbol) }));
};
