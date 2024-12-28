import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { ListDashes } from "@phosphor-icons/react/dist/ssr/ListDashes";
import { Alert, AlertTrigger } from "@pythnetwork/component-library/Alert";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Breadcrumbs } from "@pythnetwork/component-library/Breadcrumbs";
import { Button } from "@pythnetwork/component-library/Button";
import { Drawer, DrawerTrigger } from "@pythnetwork/component-library/Drawer";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./layout.module.scss";
import { PriceFeedSelect } from "./price-feed-select";
import { ReferenceData } from "./reference-data";
import { toHex } from "../../hex";
import { getData } from "../../services/pyth";
import { YesterdaysPricesProvider, ChangePercent } from "../ChangePercent";
import { FeedKey } from "../FeedKey";
import {
  LivePrice,
  LiveConfidence,
  LiveLastUpdated,
  LiveValue,
} from "../LivePrices";
import { PriceFeedTag } from "../PriceFeedTag";
import { TabPanel, TabRoot, Tabs } from "../Tabs";

type Props = {
  children: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export const PriceFeedLayout = async ({ children, params }: Props) => {
  const [{ slug }, data] = await Promise.all([params, getData()]);
  const symbol = decodeURIComponent(slug);
  const feed = data.find((item) => item.symbol === symbol);

  return feed ? (
    <div className={styles.priceFeedLayout}>
      <section className={styles.header}>
        <div className={styles.headerRow}>
          <Breadcrumbs
            label="Breadcrumbs"
            items={[
              { href: "/", label: "Home" },
              { href: "/price-feeds", label: "Price Feeds" },
              { label: feed.product.display_symbol },
            ]}
          />
          <div>
            <Badge variant="neutral" style="outline" size="md">
              {feed.product.asset_type.toUpperCase()}
            </Badge>
          </div>
        </div>
        <div className={styles.headerRow}>
          <PriceFeedSelect
            feeds={data
              .filter((feed) => feed.symbol !== symbol)
              .map((feed) => ({
                id: encodeURIComponent(feed.symbol),
                key: toHex(feed.product.price_account),
                displaySymbol: feed.product.display_symbol,
                name: <PriceFeedTag compact feed={feed} />,
                assetClassText: feed.product.asset_type,
                assetClass: (
                  <Badge variant="neutral" style="outline" size="xs">
                    {feed.product.asset_type.toUpperCase()}
                  </Badge>
                ),
              }))}
          >
            <PriceFeedTag feed={feed} />
          </PriceFeedSelect>
          <div className={styles.rightGroup}>
            <FeedKey
              variant="ghost"
              size="sm"
              className={styles.feedKey ?? ""}
              feed={feed}
            />
            <DrawerTrigger>
              <Button variant="outline" size="sm" beforeIcon={ListDashes}>
                Reference Data
              </Button>
              <Drawer fill title="Reference Data">
                <ReferenceData feed={feed} />
              </Drawer>
            </DrawerTrigger>
          </div>
        </div>
        <section className={styles.stats}>
          <StatCard
            variant="primary"
            header="Aggregated Price"
            stat={<LivePrice feed={feed} />}
          />
          <StatCard
            header="Confidence"
            stat={<LiveConfidence feed={feed} />}
            corner={
              <AlertTrigger>
                <Button
                  variant="ghost"
                  size="xs"
                  beforeIcon={(props) => <Info weight="fill" {...props} />}
                  rounded
                  hideText
                  className={styles.confidenceExplainButton ?? ""}
                >
                  Explain Confidence
                </Button>
                <Alert title="Confidence" icon={<Lightbulb />}>
                  <p className={styles.confidenceDescription}>
                    <b>Confidence</b> is how far from the aggregate price Pyth
                    believes the true price might be. It reflects a combination
                    of the confidence of individual quoters and how well
                    individual quoters agree with each other.
                  </p>
                  <Button
                    size="xs"
                    variant="solid"
                    href="https://docs.pyth.network/price-feeds/best-practices#confidence-intervals"
                    target="_blank"
                  >
                    Learn more
                  </Button>
                </Alert>
              </AlertTrigger>
            }
          />
          <StatCard
            header="1-Day Price Change"
            stat={
              <YesterdaysPricesProvider feeds={[feed]}>
                <ChangePercent feed={feed} />
              </YesterdaysPricesProvider>
            }
          />
          <StatCard
            header="Last Updated"
            stat={<LiveLastUpdated feed={feed} />}
          />
        </section>
      </section>
      <TabRoot>
        <Tabs
          label="Price Feed Navigation"
          prefix={`/price-feeds/${slug}`}
          items={[
            { segment: undefined, children: "Chart" },
            {
              segment: "publishers",
              children: (
                <div className={styles.priceComponentsTabLabel}>
                  <span>Publishers</span>
                  <Badge size="xs" style="filled" variant="neutral">
                    <LiveValue feed={feed} field="numComponentPrices" />
                  </Badge>
                </div>
              ),
            },
          ]}
        />
        <TabPanel className={styles.body ?? ""}>{children}</TabPanel>
      </TabRoot>
    </div>
  ) : (
    notFound()
  );
};
