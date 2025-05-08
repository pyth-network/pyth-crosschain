import type { Metadata } from "next";

export { PriceFeeds as default } from "../../components/PriceFeeds";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    default: "Price Feeds",
    template: "%s | Price Feeds | Pyth Network Insights",
  },
  description: "Explore market data on the Pyth network.",
};
