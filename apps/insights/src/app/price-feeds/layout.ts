import type { Metadata } from "next";

export { ZoomLayoutTransition as default } from "../../components/ZoomLayoutTransition";

export const metadata: Metadata = {
  title: {
    default: "Price Feeds",
    template: "%s | Price Feeds | Pyth Network Insights",
  },
  description: "Explore market data on the Pyth network.",
};
