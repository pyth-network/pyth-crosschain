import "./css-vars.scss";

import { AppShell } from "@pythnetwork/component-library/AppShell";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import type { ReactNode } from "react";
import {
  AMPLITUDE_API_KEY,
  ENABLE_ACCESSIBILITY_REPORTING,
  GOOGLE_ANALYTICS_ID,
} from "../../config/server";
import { getPublishersWithRankings } from "../../get-publishers-with-rankings";
import { Cluster } from "../../services/pyth";
import { getFeeds } from "../../services/pyth/get-feeds";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PublisherIcon } from "../PublisherIcon";
import { SearchButton as SearchButtonImpl } from "./search-button";

export const TABS = [
  { children: "Overview", segment: "" },
  { children: "Publishers", segment: "publishers" },
  { children: "Price Feeds", segment: "price-feeds" },
];

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
  <AppShell
    amplitudeApiKey={AMPLITUDE_API_KEY}
    appName="Insights"
    enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
    extraCta={<SearchButton />}
    googleAnalyticsId={GOOGLE_ANALYTICS_ID}
    providers={[NuqsAdapter]}
    tabs={TABS}
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

  return <SearchButtonImpl feeds={feeds} publishers={publishers.flat()} />;
};

const getPublishersForSearchDialog = async (cluster: Cluster) => {
  const publishers = await getPublishersWithRankings(cluster);
  return publishers.map((publisher) => {
    const knownPublisher = lookupPublisher(publisher.key);

    return {
      averageScore: publisher.averageScore,
      cluster,
      publisherKey: publisher.key,
      ...(knownPublisher && {
        icon: <PublisherIcon knownPublisher={knownPublisher} />,
        name: knownPublisher.name,
      }),
    };
  });
};

const getFeedsForSearchDialog = async (cluster: Cluster) => {
  const feeds = await getFeeds(cluster);
  return feeds.map((feed) => ({
    assetClass: feed.product.asset_type,
    description: feed.product.description,
    displaySymbol: feed.product.display_symbol,
    icon: <PriceFeedIcon assetClass={feed.product.asset_type} />,
    priceAccount: feed.product.price_account,
    symbol: feed.symbol,
  }));
};
