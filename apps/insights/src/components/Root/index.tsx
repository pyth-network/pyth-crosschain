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
import { toHex } from "../../hex";
import { getPublishers } from "../../services/clickhouse";
import { Cluster, getData } from "../../services/pyth";
import { LivePricesProvider } from "../LivePrices";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PublisherIcon } from "../PublisherIcon";

type Props = {
  children: ReactNode;
};

export const Root = async ({ children }: Props) => {
  const [data, publishers] = await Promise.all([
    getData(Cluster.Pythnet),
    getPublishers(),
  ]);

  return (
    <BaseRoot
      amplitudeApiKey={AMPLITUDE_API_KEY}
      googleAnalyticsId={GOOGLE_ANALYTICS_ID}
      enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
      providers={[NuqsAdapter, LivePricesProvider]}
      className={styles.root}
    >
      <SearchDialogProvider
        feeds={data.map((feed) => ({
          id: feed.symbol,
          key: toHex(feed.product.price_account),
          displaySymbol: feed.product.display_symbol,
          icon: <PriceFeedIcon symbol={feed.symbol} />,
          assetClass: feed.product.asset_type,
        }))}
        publishers={publishers.map((publisher) => {
          const knownPublisher = lookupPublisher(publisher.key);
          return {
            id: publisher.key,
            medianScore: publisher.medianScore,
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
