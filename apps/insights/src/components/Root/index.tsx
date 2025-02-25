import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { Root as BaseRoot } from "@pythnetwork/next-root";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { Footer } from "./footer";
import { Header } from "./header";
import styles from "./index.module.scss";
import { MobileNavTabs } from "./mobile-nav-tabs";
import { SearchDialogProvider } from "./search-dialog";
import { TabRoot, TabPanel } from "./tabs";
import {
  ENABLE_ACCESSIBILITY_REPORTING,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
} from "../../config/server";
import { LivePriceDataProvider } from "../../hooks/use-live-price-data";
import { PriceFeedsProvider as PriceFeedsProviderImpl } from "../../hooks/use-price-feeds";
import { getPublishers } from "../../services/clickhouse";
import { Cluster, getFeeds } from "../../services/pyth";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PublisherIcon } from "../PublisherIcon";

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

export const Root = async ({ children }: Props) => {
  const publishers = await Promise.all([
    getPublishersForSearchDialog(Cluster.Pythnet),
    getPublishersForSearchDialog(Cluster.PythtestConformance),
  ]);

  return (
    <BaseRoot
      amplitudeApiKey={AMPLITUDE_API_KEY}
      googleAnalyticsId={GOOGLE_ANALYTICS_ID}
      enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
      providers={[NuqsAdapter, LivePriceDataProvider, PriceFeedsProvider]}
      className={styles.root}
    >
      <SearchDialogProvider publishers={publishers.flat()}>
        <TabRoot className={styles.tabRoot ?? ""}>
          <Header className={styles.header} tabs={TABS} />
          <main className={styles.main}>
            <TabPanel>{children}</TabPanel>
          </main>
          <Footer />
          <MobileNavTabs tabs={TABS} className={styles.mobileNavTabs} />
        </TabRoot>
      </SearchDialogProvider>
    </BaseRoot>
  );
};

const getPublishersForSearchDialog = async (cluster: Cluster) => {
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

const PriceFeedsProvider = async ({ children }: { children: ReactNode }) => {
  const [pythnetFeeds, pythtestConformanceFeeds] = await Promise.all([
    getFeeds(Cluster.Pythnet),
    getFeeds(Cluster.PythtestConformance),
  ]);

  const feedMap = new Map(
    pythnetFeeds.map((feed) => [
      feed.symbol,
      {
        displaySymbol: feed.product.display_symbol,
        icon: (
          <PriceFeedIcon
            assetClass={feed.product.asset_type}
            symbol={feed.product.display_symbol}
          />
        ),
        description: feed.product.description,
        key: {
          [Cluster.Pythnet]: feed.product.price_account,
          [Cluster.PythtestConformance]:
            pythtestConformanceFeeds.find(
              (conformanceFeed) => conformanceFeed.symbol === feed.symbol,
            )?.product.price_account ?? "",
        },
        assetClass: feed.product.asset_type,
      },
    ]),
  );

  return (
    <PriceFeedsProviderImpl value={feedMap}>{children}</PriceFeedsProviderImpl>
  );
};
