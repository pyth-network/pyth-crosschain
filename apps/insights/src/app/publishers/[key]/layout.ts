import type { Metadata } from "next";

export { PublishersLayout as default } from "../../../components/Publisher/layout";

export const metadata: Metadata = {
  title: "Publishers",
};

export const revalidate = 3600;
