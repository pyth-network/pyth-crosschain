import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { ListDashes } from "@phosphor-icons/react/dist/ssr/ListDashes";
import { Alert, AlertTrigger } from "@pythnetwork/component-library/Alert";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Breadcrumbs } from "@pythnetwork/component-library/Breadcrumbs";
import { Button, ButtonLink } from "@pythnetwork/component-library/Button";
import { Drawer, DrawerTrigger } from "@pythnetwork/component-library/Drawer";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import type { ReactNode } from "react";
import { z } from "zod";

import styles from "./layout.module.scss";
import { ReferenceData } from "./reference-data";
import { TabPanel, TabRoot, Tabs } from "./tabs";
import { client } from "../../services/pyth";
import { YesterdaysPricesProvider, ChangePercent } from "../ChangePercent";
import { FeedKey } from "../FeedKey";
import { LivePrice, LiveConfidence, LiveLastUpdated } from "../LivePrices";
import { NotFound } from "../NotFound";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = {
  children: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export const PriceFeedLayout = async ({ children, params }: Props) => {
  const { slug } = await params;
  const feed = await getPriceFeed(decodeURIComponent(slug));

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
          <PriceFeedTag feed={feed} />
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
              <Drawer title="Reference Data">
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
                  <ButtonLink
                    size="xs"
                    variant="solid"
                    href="https://docs.pyth.network/price-feeds/best-practices#confidence-intervals"
                    target="_blank"
                  >
                    Learn more
                  </ButtonLink>
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
          slug={slug}
          items={[
            { segment: undefined, children: "Chart" },
            {
              segment: "price-components",
              children: (
                <div className={styles.priceComponentsTabLabel}>
                  <span>Price Components</span>
                  <Badge size="xs" style="filled" variant="neutral">
                    {feed.price.numComponentPrices}
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
    <NotFound />
  );
};

const getPriceFeed = async (symbol: string) => {
  const data = await client.getData();
  const priceFeeds = priceFeedsSchema.parse(
    data.symbols.map((symbol) => ({
      symbol,
      product: data.productFromSymbol.get(symbol),
      price: data.productPrice.get(symbol),
    })),
  );
  return priceFeeds.find((feed) => feed.symbol === symbol);
};

const priceFeedsSchema = z.array(
  z.object({
    symbol: z.string(),
    product: z.object({
      display_symbol: z.string(),
      asset_type: z.string(),
      description: z.string(),
      price_account: z.string(),
      base: z.string().optional(),
      country: z.string().optional(),
      quote_currency: z.string().optional(),
      tenor: z.string().optional(),
      cms_symbol: z.string().optional(),
      cqs_symbol: z.string().optional(),
      nasdaq_symbol: z.string().optional(),
      generic_symbol: z.string().optional(),
      weekly_schedule: z.string().optional(),
      schedule: z.string().optional(),
      contract_id: z.string().optional(),
    }),
    price: z.object({
      exponent: z.number(),
      numComponentPrices: z.number(),
      numQuoters: z.number(),
      minPublishers: z.number(),
      lastSlot: z.bigint(),
      validSlot: z.bigint(),
    }),
  }),
);
