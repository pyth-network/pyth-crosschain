import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { Root as BaseRoot } from "@pythnetwork/next-root";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { createElement } from "react";

import { Footer } from "./footer";
import { Header } from "./header";
// import { MobileMenu } from "./mobile-menu";
import styles from "./index.module.scss";
import { SearchDialogProvider } from "./search-dialog";
import { TabRoot, TabPanel } from "./tabs";
import {
  IS_PRODUCTION_SERVER,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
} from "../../config/server";
import { toHex } from "../../hex";
import { getPublishers } from "../../services/clickhouse";
import { getData } from "../../services/pyth";
import { LivePricesProvider } from "../LivePrices";
import { PriceFeedIcon } from "../PriceFeedIcon";

type Props = {
  children: ReactNode;
};

export const Root = async ({ children }: Props) => {
  const [data, publishers] = await Promise.all([getData(), getPublishers()]);

  return (
    <BaseRoot
      amplitudeApiKey={AMPLITUDE_API_KEY}
      googleAnalyticsId={GOOGLE_ANALYTICS_ID}
      enableAccessibilityReporting={!IS_PRODUCTION_SERVER}
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
              icon: createElement(knownPublisher.icon.color),
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
