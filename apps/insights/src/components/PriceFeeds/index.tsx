import { ArrowLineDown } from "@phosphor-icons/react/dist/ssr/ArrowLineDown";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { ArrowsOutSimple } from "@phosphor-icons/react/dist/ssr/ArrowsOutSimple";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr/ClockCountdown";
import { StackPlus } from "@phosphor-icons/react/dist/ssr/StackPlus";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
import {
  type Props as CardProps,
  Card,
} from "@pythnetwork/component-library/Card";
import { Drawer, DrawerTrigger } from "@pythnetwork/component-library/Drawer";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import type { ElementType } from "react";

import { AssetClassesDrawer } from "./asset-classes-drawer";
import { ComingSoonList } from "./coming-soon-list";
import styles from "./index.module.scss";
import { PriceFeedsCard } from "./price-feeds-card";
import { Cluster, getFeeds } from "../../services/pyth";
import { priceFeeds as priceFeedsStaticConfig } from "../../static-data/price-feeds";
import { activeChains } from "../../static-data/stats";
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
  ].slice(0, 5);
  const featuredRecentlyAdded = filterFeeds(
    priceFeeds.activeFeeds,
    priceFeedsStaticConfig.featuredRecentlyAdded,
  );

  return (
    <div className={styles.priceFeeds}>
      <h1 className={styles.header}>Price Feeds</h1>
      <div className={styles.body}>
        <section className={styles.stats}>
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
        </section>
        <YesterdaysPricesProvider
          feeds={Object.fromEntries(
            featuredRecentlyAdded.map(({ symbol, product }) => [
              symbol,
              product.price_account,
            ]),
          )}
        >
          <FeaturedFeedsCard
            title="Recently Added"
            icon={<StackPlus />}
            feeds={featuredRecentlyAdded}
            showPrices
            linkFeeds
          />
        </YesterdaysPricesProvider>
        <FeaturedFeedsCard
          title="Coming Soon"
          icon={<ClockCountdown />}
          feeds={featuredComingSoon}
          toolbar={
            <DrawerTrigger>
              <Button size="xs" variant="outline">
                Show all
              </Button>
              <Drawer
                fill
                className={styles.comingSoonCard ?? ""}
                title={
                  <>
                    <span>Coming Soon</span>
                    <Badge>{priceFeeds.comingSoon.length}</Badge>
                  </>
                }
              >
                <ComingSoonList
                  comingSoonSymbols={priceFeeds.comingSoon.map(
                    ({ symbol }) => symbol,
                  )}
                />
              </Drawer>
            </DrawerTrigger>
          }
        />
        <PriceFeedsCard
          id={PRICE_FEEDS_ANCHOR}
          priceFeeds={priceFeeds.activeFeeds.map((feed) => ({
            symbol: feed.symbol,
            exponent: feed.price.exponent,
            numQuoters: feed.price.numQuoters,
          }))}
        />
      </div>
    </div>
  );
};

type FeaturedFeedsCardProps<T extends ElementType> = Omit<
  CardProps<T>,
  "children"
> & {
  showPrices?: boolean | undefined;
  linkFeeds?: boolean | undefined;
  feeds: {
    symbol: string;
    product: {
      display_symbol: string;
      price_account: string;
      description: string;
    };
  }[];
};

const FeaturedFeedsCard = <T extends ElementType>({
  showPrices,
  linkFeeds,
  feeds,
  ...props
}: FeaturedFeedsCardProps<T>) => (
  <Card {...props}>
    <div className={styles.featuredFeeds}>
      {feeds.map((feed) => (
        <Card
          key={feed.product.price_account}
          variant="tertiary"
          {...(linkFeeds && {
            href: `/price-feeds/${encodeURIComponent(feed.symbol)}`,
          })}
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
