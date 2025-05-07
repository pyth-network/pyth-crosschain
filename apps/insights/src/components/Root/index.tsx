import { AppShell } from "@pythnetwork/component-library/AppShell";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Suspense } from "react";

import {
  ENABLE_ACCESSIBILITY_REPORTING,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
} from "../../config/server";
import { LivePriceDataProvider } from "../../hooks/use-live-price-data";
import { getPublishers } from "../../services/clickhouse";
import { Cluster, getFeeds } from "../../services/pyth";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PublisherIcon } from "../PublisherIcon";
import { SearchButton as SearchButtonImpl } from "./search-button";

export const TABS = [
  { segment: "", children: "Overview" },
  { segment: "publishers", children: "Publishers" },
  { segment: "price-feeds", children: "Price Feeds" },
];

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
  <AppShell
    appName="Insights"
    amplitudeApiKey={AMPLITUDE_API_KEY}
    googleAnalyticsId={GOOGLE_ANALYTICS_ID}
    enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
    providers={[NuqsAdapter, LivePriceDataProvider]}
    tabs={TABS}
    extraCta={
      <Suspense fallback={<SearchButtonImpl isLoading />}>
        <SearchButton />
      </Suspense>
    }
  >
    {children}
  </AppShell>
);

const SearchButton = async () => {
  const [publishers, feeds] = await Promise.all([
    Promise.all([
      getPublishersForSearchDialog(Cluster.Pythnet),
      getPublishersForSearchDialog(Cluster.PythtestConformance),
    ]),
    getFeedsForSearchDialog(Cluster.Pythnet),
  ]);

  return <SearchButtonImpl publishers={publishers.flat()} feeds={feeds} />;
};

const getPublishersForSearchDialog = async (cluster: Cluster) => {
  "use cache";
  const publishers = await getPublishers(cluster);
  return publishers.map((publisher) => {
    const knownPublisher = lookupPublisher(publisher.key);

    return {
      publisherKey: publisher.key,
      averageScore: publisher.averageScore,
      cluster,
      ...(knownPublisher && {
        name: knownPublisher.name,
        icon: <PublisherIcon knownPublisher={knownPublisher} />,
      }),
    };
  });
};

const getFeedsForSearchDialog = async (cluster: Cluster) => {
  "use cache";
  const feeds = await getFeeds(cluster);

  return feeds.map((feed) => ({
    symbol: feed.symbol,
    displaySymbol: feed.product.display_symbol,
    assetClass: feed.product.asset_type,
    description: feed.product.description,
    icon: (
      <PriceFeedIcon
        assetClass={feed.product.asset_type}
        symbol={feed.symbol}
      />
    ),
  }));
};
