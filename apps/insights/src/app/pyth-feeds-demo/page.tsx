import type { Metadata } from "next";
export { PythFeedsDemoPage as default } from "../../components/PythFeedsDemoPage";

export const metadata: Metadata = {
  title: {
    default: "Pyth Realtime Feed Comparison Tool",
    template: "%s | Realtime Feed Comparison | Pyth Network Insights",
  },
  description:
    "A real-time price monitoring demo that fetches live price data from multiple exchanges and displays it in an interactive chart.",
  robots: {
    index: false,
    follow: false,
  },
};
