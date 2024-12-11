import type { Metadata } from "next";

import { client } from "../../../services/pyth";
export { PriceFeedLayout as default } from "../../../components/PriceFeed/layout";

export const metadata: Metadata = {
  title: "Price Feeds",
};

export const generateStaticParams = async () => {
  const data = await client.getData();
  return data.symbols.map((symbol) => ({ slug: encodeURIComponent(symbol) }));
};
