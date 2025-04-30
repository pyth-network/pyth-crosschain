import type { Metadata } from "next";
export { Publishers as default } from "../../components/Publishers";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    default: "Publishers",
    template: "%s | Publishers | Pyth Network Insights",
  },
  description: "Explore publishers who contribute to the Pyth network.",
};
