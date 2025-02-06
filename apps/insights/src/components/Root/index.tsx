import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { Root as BaseRoot } from "@pythnetwork/next-root";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { Footer } from "./footer";
import { Header } from "./header";
// import { MobileMenu } from "./mobile-menu";
import styles from "./index.module.scss";
import { SearchDialogProvider } from "./search-dialog";
import { TabRoot, TabPanel } from "./tabs";
import {
  ENABLE_ACCESSIBILITY_REPORTING,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
} from "../../config/server";
// import { toHex } from "../../hex";
import { LivePriceDataProvider } from "../../hooks/use-live-price-data";
import { PriceFeedsProvider as PriceFeedsProviderImpl } from "../../hooks/use-price-feeds";
import { getPublishers } from "../../services/clickhouse";
import { Cluster, getFeeds } from "../../services/pyth";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PublisherIcon } from "../PublisherIcon";

type Props = {
  children: ReactNode;
};

export const Root = async ({ children }: Props) => {
  const publishers = await getPublishers();

  return (
    <BaseRoot
      amplitudeApiKey={AMPLITUDE_API_KEY}
      googleAnalyticsId={GOOGLE_ANALYTICS_ID}
      enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
      providers={[NuqsAdapter, LivePriceDataProvider, PriceFeedsProvider]}
      className={styles.root}
    >
      <SearchDialogProvider
        publishers={publishers.map((publisher) => {
          const knownPublisher = lookupPublisher(publisher.key);
          return {
            id: publisher.key,
            averageScore: publisher.averageScore,
            ...(knownPublisher && {
              name: knownPublisher.name,
              icon: <PublisherIcon knownPublisher={knownPublisher} />,
            }),
          };
        })}
      >
        <TabRoot className={styles.tabRoot ?? ""}>
          <Header className={styles.header} />
          <main className={styles.main}>
            <TabPanel>{children}</TabPanel>
          </main>
          <Footer />
        </TabRoot>
      </SearchDialogProvider>
    </BaseRoot>
  );
};

const PriceFeedsProvider = async ({ children }: { children: ReactNode }) => {
  const feeds = await getFeeds(Cluster.Pythnet);

  const feedMap = new Map(
    feeds.map((feed) => [
      feed.symbol,
      {
        displaySymbol: feed.product.display_symbol,
        icon: <PriceFeedIcon symbol={feed.product.display_symbol} />,
        description: feed.product.description,
        key: feed.product.price_account,
        assetClass: feed.product.asset_type,
      },
    ]),
  );

  return (
    <PriceFeedsProviderImpl value={feedMap}>{children}</PriceFeedsProviderImpl>
  );
};
