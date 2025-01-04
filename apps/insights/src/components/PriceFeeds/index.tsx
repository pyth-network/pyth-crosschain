import { ArrowLineDown } from "@phosphor-icons/react/dist/ssr/ArrowLineDown";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr/ClockCountdown";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
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
import { Cluster, getData } from "../../services/pyth";
import { priceFeeds as priceFeedsStaticConfig } from "../../static-data/price-feeds";
import { YesterdaysPricesProvider, ChangePercent } from "../ChangePercent";
import { LivePrice } from "../LivePrices";
import { PriceFeedIcon } from "../PriceFeedIcon";
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
            stat={priceFeedsStaticConfig.activeChains}
            href="https://docs.pyth.network/price-feeds/contract-addresses"
            target="_blank"
            corner={<ArrowSquareOut weight="fill" />}
          />
          <AssetClassesDrawer numFeedsByAssetClass={numFeedsByAssetClass}>
            <StatCard
              header="Asset Classes"
              stat={Object.keys(numFeedsByAssetClass).length}
              corner={<Info weight="fill" />}
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
                  comingSoonFeeds={priceFeeds.comingSoon.map((feed) => ({
                    id: feed.product.price_account,
                    displaySymbol: feed.product.display_symbol,
                    assetClass: feed.product.asset_type,
                    icon: (
                      <PriceFeedIcon symbol={feed.product.display_symbol} />
                    ),
                  }))}
                />
              </Drawer>
            </DrawerTrigger>
          }
        />
        <PriceFeedsCard
          id={PRICE_FEEDS_ANCHOR}
          priceFeeds={priceFeeds.activeFeeds.map((feed) => ({
            symbol: feed.symbol,
            icon: <PriceFeedIcon symbol={feed.product.display_symbol} />,
            id: feed.product.price_account,
            displaySymbol: feed.product.display_symbol,
            assetClass: feed.product.asset_type,
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
            <PriceFeedTag
              symbol={feed.product.display_symbol}
              description={feed.product.description}
              icon={<PriceFeedIcon symbol={feed.product.display_symbol} />}
            />
            {showPrices && (
              <div className={styles.prices}>
                <LivePrice feedKey={feed.product.price_account} />
                <ChangePercent
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
  const priceFeeds = await getData(Cluster.Pythnet);
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
  symbols.map((symbol) => {
    const feed = feeds.find((feed) => feed.symbol === symbol);
    if (feed) {
      return feed;
    } else {
      throw new NoSuchFeedError(symbol);
    }
  });

const isActive = (feed: { price: { minPublishers: number } }) =>
  feed.price.minPublishers <= 50;

class NoSuchFeedError extends Error {
  constructor(symbol: string) {
    super(`No feed exists named ${symbol}`);
    this.name = "NoSuchFeedError";
  }
}
