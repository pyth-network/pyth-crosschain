import type { Metadata } from "next";

export { PriceFeeds as default } from "../../components/PriceFeeds";

export const metadata: Metadata = {
  title: "Price Feeds",
};

export const dynamic = "error";
export const revalidate = 3600;
