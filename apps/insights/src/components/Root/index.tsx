import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { Root as BaseRoot } from "@pythnetwork/next-root";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { Footer } from "./footer";
import { Header } from "./header";
import styles from "./index.module.scss";
import { MobileNavTabs } from "./mobile-nav-tabs";
import { TabRoot, TabPanel } from "./tabs";
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
import { SearchButtonProvider as SearchButtonProviderImpl } from "./search-button";

export const TABS = [
  { href: "/", id: "", children: "Overview" },
  { href: "/publishers", id: "publishers", children: "Publishers" },
  {
    href: "/price-feeds",
    id: "price-feeds",
    children: "Price Feeds",
  },
];

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => {
  return (
    <BaseRoot
      amplitudeApiKey={AMPLITUDE_API_KEY}
      googleAnalyticsId={GOOGLE_ANALYTICS_ID}
      enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
      providers={[NuqsAdapter, LivePriceDataProvider]}
      className={styles.root}
    >
      <SearchButtonProvider>
        <TabRoot className={styles.tabRoot ?? ""}>
          <Header className={styles.header} tabs={TABS} />
          <main className={styles.main}>
            <TabPanel>{children}</TabPanel>
          </main>
          <Footer />
          <MobileNavTabs tabs={TABS} className={styles.mobileNavTabs} />
        </TabRoot>
      </SearchButtonProvider>
    </BaseRoot>
  );
};

const SearchButtonProvider = async ({ children }: { children: ReactNode }) => {
  const [publishers, feeds] = await Promise.all([
    Promise.all([
      getPublishersForSearchDialog(Cluster.Pythnet),
      getPublishersForSearchDialog(Cluster.PythtestConformance),
    ]),
    getFeedsForSearchDialog(Cluster.Pythnet),
  ]);

  return (
    <SearchButtonProviderImpl publishers={publishers.flat()} feeds={feeds}>
      {children}
    </SearchButtonProviderImpl>
  );
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
