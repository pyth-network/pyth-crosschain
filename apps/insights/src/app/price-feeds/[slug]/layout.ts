import type { Metadata } from "next";

export { PriceFeedLayout as default } from "../../../components/PriceFeed/layout";

export const metadata: Metadata = {
  title: "Price Feeds",
};

export const dynamic = "error";
export const revalidate = 3600;
