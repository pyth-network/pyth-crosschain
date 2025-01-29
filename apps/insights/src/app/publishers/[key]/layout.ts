import type { Metadata } from "next";

export { PublishersLayout as default } from "../../../components/Publisher/layout";
import { getPublishers } from "../../../services/clickhouse";

export const metadata: Metadata = {
  title: "Publishers",
};

export const generateStaticParams = async () => {
  const publishers = await getPublishers();
  return publishers.map(({ key }) => ({ key }));
};
