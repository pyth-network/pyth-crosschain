import { ArrowLineDown } from "@phosphor-icons/react/dist/ssr/ArrowLineDown";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { ArrowsOutSimple } from "@phosphor-icons/react/dist/ssr/ArrowsOutSimple";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr/ClockCountdown";
import { Star } from "@phosphor-icons/react/dist/ssr/Star";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
import type { Props as CardProps } from "@pythnetwork/component-library/Card";
import { Card } from "@pythnetwork/component-library/Card";
import { Drawer, DrawerTrigger } from "@pythnetwork/component-library/Drawer";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { TabList } from "@pythnetwork/component-library/TabList";
import {
  TabPanel as UnstyledTabPanel,
  Tabs as UnstyledTabs,
} from "@pythnetwork/component-library/unstyled/Tabs";
import type { ElementType } from "react";

import { AssetClassesDrawer } from "./asset-classes-drawer";
import { ComingSoonList } from "./coming-soon-list";
import styles from "./index.module.scss";
import { PriceFeedsCard } from "./price-feeds-card";
import { Cluster, getFeeds } from "../../services/pyth";
import { priceFeeds as priceFeedsStaticConfig } from "../../static-data/price-feeds";
import { activeChains } from "../../static-data/stats";
import { Cards } from "../Cards";
import { LivePrice } from "../LivePrices";
import {
  YesterdaysPricesProvider,
  PriceFeedChangePercent,
} from "../PriceFeedChangePercent";
import { PriceFeedTag } from "../PriceFeedTag";

const PRICE_FEEDS_ANCHOR = "priceFeeds";

export const PriceFeeds = async () => {
  const priceFeeds = await getPriceFeeds();
  const numFeedsByAssetClass = getNumFeedsByAssetClass(priceFeeds.activeFeeds);
  const featuredComingSoon = [
    ...filterFeeds(
      priceFeeds.comingSoon,
      priceFeedsStaticConfig.featuredComingSoon,
    ),
    ...priceFeeds.comingSoon.filter(
      ({ symbol }) =>
        !priceFeedsStaticConfig.featuredComingSoon.includes(symbol),
    ),
  ].slice(0, 6);
  const featuredFeeds = filterFeeds(
    priceFeeds.activeFeeds,
    priceFeedsStaticConfig.featuredFeeds,
  );

  return (
    <div className={styles.priceFeeds}>
      <h1 className={styles.header}>Price Feeds</h1>
      <Cards className={styles.cards}>
        <StatCard
          variant="primary"
          header="Active Feeds"
          stat={priceFeeds.activeFeeds.length}
          href={`#${PRICE_FEEDS_ANCHOR}`}
          corner={<ArrowLineDown />}
        />
        <StatCard
          header="Frequency"
          stat={priceFeedsStaticConfig.updateFrequency}
        />
        <StatCard
          header="Active Chains"
          stat={activeChains.at(-1)?.chains}
          href="https://docs.pyth.network/price-feeds/contract-addresses"
          target="_blank"
          corner={<ArrowSquareOut weight="fill" />}
        />
        <AssetClassesDrawer numFeedsByAssetClass={numFeedsByAssetClass}>
          <StatCard
            header="Asset Classes"
            stat={Object.keys(numFeedsByAssetClass).length}
            corner={<ArrowsOutSimple />}
          />
        </AssetClassesDrawer>
      </Cards>
      <section className={styles.bigScreenBody}>
        <FeaturedFeeds
          allComingSoon={priceFeeds.comingSoon}
          featuredComingSoon={featuredComingSoon.slice(0, 5)}
          featuredFeeds={featuredFeeds.slice(0, 5)}
        />
        <PriceFeedsCard
          id={PRICE_FEEDS_ANCHOR}
          priceFeeds={priceFeeds.activeFeeds.map((feed) => ({
            symbol: feed.symbol,
            exponent: feed.price.exponent,
            numQuoters: feed.price.numQuoters,
          }))}
        />
      </section>
      <UnstyledTabs className={styles.smallScreenBody ?? ""}>
        <TabList
          label="Price Feeds Navigation"
          items={[
            { children: "Price Feeds", id: "feeds" },
            { children: "Highlights", id: "highlights" },
          ]}
        />
        <UnstyledTabPanel id="feeds" className={styles.tabPanel ?? ""}>
          <PriceFeedsCard
            id={PRICE_FEEDS_ANCHOR}
            priceFeeds={priceFeeds.activeFeeds.map((feed) => ({
              symbol: feed.symbol,
              exponent: feed.price.exponent,
              numQuoters: feed.price.numQuoters,
            }))}
          />
        </UnstyledTabPanel>
        <UnstyledTabPanel id="highlights" className={styles.tabPanel ?? ""}>
          <FeaturedFeeds
            allComingSoon={priceFeeds.comingSoon}
            featuredComingSoon={featuredComingSoon}
            featuredFeeds={featuredFeeds}
          />
        </UnstyledTabPanel>
      </UnstyledTabs>
    </div>
  );
};

type FeaturedFeedsProps = {
  featuredFeeds: FeaturedFeed[];
  featuredComingSoon: FeaturedFeed[];
  allComingSoon: { symbol: string }[];
};

const FeaturedFeeds = ({
  featuredFeeds,
  featuredComingSoon,
  allComingSoon,
}: FeaturedFeedsProps) => (
  <>
    <YesterdaysPricesProvider
      feeds={Object.fromEntries(
        featuredFeeds.map(({ symbol, product }) => [
          symbol,
          product.price_account,
        ]),
      )}
    >
      <FeaturedFeedsCard
        title="Featured"
        icon={<Star />}
        feeds={featuredFeeds}
        showPrices
      />
    </YesterdaysPricesProvider>
    <FeaturedFeedsCard
      title="Coming Soon"
      icon={<ClockCountdown />}
      feeds={featuredComingSoon}
      toolbarAlwaysOnTop
      toolbar={
        <DrawerTrigger>
          <Button size="sm" variant="outline">
            Show all
          </Button>
          <Drawer
            fill
            className={styles.comingSoonCard ?? ""}
            title={
              <>
                <span>Coming Soon</span>
                <Badge>{allComingSoon.length}</Badge>
              </>
            }
          >
            <ComingSoonList
              comingSoonSymbols={allComingSoon.map(({ symbol }) => symbol)}
            />
          </Drawer>
        </DrawerTrigger>
      }
    />
  </>
);

type FeaturedFeedsCardProps<T extends ElementType> = Omit<
  CardProps<T>,
  "children"
> & {
  showPrices?: boolean | undefined;
  feeds: FeaturedFeed[];
};

type FeaturedFeed = {
  symbol: string;
  product: {
    display_symbol: string;
    price_account: string;
    description: string;
  };
};

const FeaturedFeedsCard = <T extends ElementType>({
  showPrices,
  feeds,
  ...props
}: FeaturedFeedsCardProps<T>) => (
  <Card {...props}>
    <div className={styles.featuredFeedsCard}>
      {feeds.map((feed) => (
        <Card
          key={feed.product.price_account}
          variant="tertiary"
          href={`/price-feeds/${encodeURIComponent(feed.symbol)}`}
        >
          <div className={styles.feedCardContents}>
            <PriceFeedTag symbol={feed.symbol} />
            {showPrices && (
              <div className={styles.prices}>
                <LivePrice
                  feedKey={feed.product.price_account}
                  cluster={Cluster.Pythnet}
                />
                <PriceFeedChangePercent
                  className={styles.changePercent}
                  feedKey={feed.product.price_account}
                />
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  </Card>
);

const getPriceFeeds = async () => {
  const priceFeeds = await getFeeds(Cluster.Pythnet);
  const activeFeeds = priceFeeds.filter((feed) => isActive(feed));
  const comingSoon = priceFeeds.filter((feed) => !isActive(feed));
  return { activeFeeds, comingSoon };
};

const getNumFeedsByAssetClass = (
  feeds: { product: { asset_type: string } }[],
): Record<string, number> => {
  const classes: Record<string, number> = {};
  for (const feed of feeds) {
    const assetType = feed.product.asset_type;
    classes[assetType] = (classes[assetType] ?? 0) + 1;
  }
  return classes;
};

const filterFeeds = <T extends { symbol: string }>(
  feeds: T[],
  symbols: string[],
): T[] =>
  symbols
    .map((symbol) => feeds.find((feed) => feed.symbol === symbol))
    .filter((feed) => feed !== undefined);

const isActive = (feed: { price: { minPublishers: number } }) =>
  feed.price.minPublishers <= 50;
