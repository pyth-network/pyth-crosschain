import { ArrowLineDown } from "@phosphor-icons/react/dist/ssr/ArrowLineDown";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { ArrowsOutSimple } from "@phosphor-icons/react/dist/ssr/ArrowsOutSimple";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr/ClockCountdown";
import { Star } from "@phosphor-icons/react/dist/ssr/Star";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
import type { Props as CardProps } from "@pythnetwork/component-library/Card";
import { Card } from "@pythnetwork/component-library/Card";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { TabList } from "@pythnetwork/component-library/TabList";
import {
  TabPanel as UnstyledTabPanel,
  Tabs as UnstyledTabs,
} from "@pythnetwork/component-library/unstyled/Tabs";
import type { ElementType } from "react";
import { Cluster } from "../../services/pyth";
import { getFeeds } from "../../services/pyth/get-feeds";
import { priceFeeds as priceFeedsStaticConfig } from "../../static-data/price-feeds";
import { activeChains } from "../../static-data/stats";
import { Cards } from "../Cards";
import { LivePrice } from "../LivePrices";
import { PriceCard } from "../PriceCard";
import {
  PriceFeedChangePercent,
  YesterdaysPricesProvider,
} from "../PriceFeedChangePercent";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { AssetClassTable } from "./asset-class-table";
import { ComingSoonList } from "./coming-soon-list";
import styles from "./index.module.scss";
import { PriceFeedsCard } from "./price-feeds-card";

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
  const numAssetClasses = Object.keys(numFeedsByAssetClass).length;

  return (
    <div className={styles.priceFeeds}>
      <h1 className={styles.header}>Price Feeds</h1>
      <Cards className={styles.cards}>
        <StatCard
          corner={<ArrowLineDown />}
          header="Active Feeds"
          href={`#${PRICE_FEEDS_ANCHOR}`}
          stat={priceFeeds.activeFeeds.length}
          variant="primary"
        />
        <StatCard
          header="Frequency"
          stat={priceFeedsStaticConfig.updateFrequency}
        />
        <StatCard
          corner={<ArrowSquareOut weight="fill" />}
          header="Active Chains"
          href="https://docs.pyth.network/price-feeds/contract-addresses"
          stat={activeChains.at(-1)?.chains}
          target="_blank"
        />
        <StatCard
          corner={<ArrowsOutSimple />}
          drawer={{
            contents: (
              <AssetClassTable numFeedsByAssetClass={numFeedsByAssetClass} />
            ),
            fill: true,
            title: (
              <>
                <span>Asset Classes</span>
                <Badge>{numAssetClasses}</Badge>
              </>
            ),
          }}
          header="Asset Classes"
          stat={Object.keys(numFeedsByAssetClass).length}
        />
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
            assetClass: feed.product.asset_type,
            description: feed.product.description,
            displaySymbol: feed.product.display_symbol,
            exponent: feed.price.exponent,
            icon: <PriceFeedIcon assetClass={feed.product.asset_type} />,
            key: feed.product.price_account,
            numQuoters: feed.price.numQuoters,
            symbol: feed.symbol,
          }))}
        />
      </section>
      <UnstyledTabs className={styles.smallScreenBody ?? ""}>
        <TabList
          items={[
            { children: "Price Feeds", id: "feeds" },
            { children: "Highlights", id: "highlights" },
          ]}
          label="Price Feeds Navigation"
        />
        <UnstyledTabPanel className={styles.tabPanel ?? ""} id="feeds">
          <PriceFeedsCard
            id={PRICE_FEEDS_ANCHOR}
            priceFeeds={priceFeeds.activeFeeds.map((feed) => ({
              assetClass: feed.product.asset_type,
              description: feed.product.description,
              displaySymbol: feed.product.display_symbol,
              exponent: feed.price.exponent,
              icon: <PriceFeedIcon assetClass={feed.product.asset_type} />,
              key: feed.product.price_account,
              numQuoters: feed.price.numQuoters,
              symbol: feed.symbol,
            }))}
          />
        </UnstyledTabPanel>
        <UnstyledTabPanel className={styles.tabPanel ?? ""} id="highlights">
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
  allComingSoon: FeaturedFeed[];
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
        feeds={featuredFeeds}
        icon={<Star />}
        showPrices
        title="Featured"
      />
    </YesterdaysPricesProvider>
    <FeaturedFeedsCard
      feeds={featuredComingSoon}
      icon={<ClockCountdown />}
      title="Coming Soon"
      toolbar={
        <Button
          drawer={{
            bodyClassName: styles.comingSoonCard ?? "",
            contents: (
              <ComingSoonList
                comingSoonFeeds={allComingSoon.map((feed) => ({
                  assetClass: feed.product.asset_type,
                  description: feed.product.description,
                  displaySymbol: feed.product.display_symbol,
                  icon: <PriceFeedIcon assetClass={feed.product.asset_type} />,
                  symbol: feed.symbol,
                }))}
              />
            ),
            fill: true,
            title: (
              <>
                <span>Coming Soon</span>
                <Badge>{allComingSoon.length}</Badge>
              </>
            ),
          }}
          size="sm"
          variant="outline"
        >
          Show all
        </Button>
      }
      toolbarAlwaysOnTop
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
    asset_type: string;
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
        <PriceCard
          assetClass={feed.product.asset_type}
          description={feed.product.description}
          displaySymbol={feed.product.display_symbol}
          href={`/price-feeds/${encodeURIComponent(feed.symbol)}`}
          key={feed.product.price_account}
        >
          {showPrices && (
            <>
              <LivePrice
                cluster={Cluster.Pythnet}
                feedKey={feed.product.price_account}
              />
              <PriceFeedChangePercent
                className={styles.changePercent}
                feedKey={feed.product.price_account}
              />
            </>
          )}
        </PriceCard>
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
