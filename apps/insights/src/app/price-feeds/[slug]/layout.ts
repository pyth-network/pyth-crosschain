import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Cluster, getFeeds } from "../../../services/pyth";

export { PriceFeedLayout as default } from "../../../components/PriceFeed/layout";

type Props = {
  feedCountBadge: ReactNode;
  header: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const [{ slug }, feeds] = await Promise.all([
    params,
    getFeeds(Cluster.Pythnet),
  ]);
  const symbol = decodeURIComponent(slug);
  const feed = feeds.find((item) => item.symbol === symbol);

  return feed
    ? {
        title: feed.product.display_symbol,
        description: `See live market quotes for ${feed.product.description}.`,
      }
    : notFound();
};

export const revalidate = 3600;
