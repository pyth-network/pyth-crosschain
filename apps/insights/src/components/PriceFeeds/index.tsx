import { ClockCountdown } from "@phosphor-icons/react/dist/ssr/ClockCountdown";
import { StackPlus } from "@phosphor-icons/react/dist/ssr/StackPlus";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import base58 from "bs58";
import Generic from "cryptocurrency-icons/svg/color/generic.svg";
import { Fragment } from "react";
import { z } from "zod";

import { AssetClassesCard } from "./asset-classes-card";
import { ComingSoonShowAllButton } from "./coming-soon-show-all-button";
import { FeaturedComingSoon } from "./featured-coming-soon";
import { FeaturedRecentlyAdded } from "./featured-recently-added";
import styles from "./index.module.scss";
import { NumActiveFeeds } from "./num-active-feeds";
import { PriceFeedsCard } from "./price-feeds-card";
import { getIcon } from "../../icons";
import { client } from "../../pyth";
import { priceFeeds as priceFeedsStaticConfig } from "../../static-data/price-feeds";
import { CopyButton } from "../CopyButton";

const PRICE_FEEDS_ANCHOR = "priceFeeds";

export const PriceFeeds = () => {
  const priceFeeds = getPriceFeeds();

  return (
    <div className={styles.priceFeeds}>
      <h1 className={styles.header}>Price Feeds</h1>
      <div className={styles.body}>
        <div className={styles.stats}>
          <StatCard
            variant="primary"
            header="Active Feeds"
            stat={
              <NumActiveFeeds
                numFeedsPromise={priceFeeds.then(
                  ({ activeFeeds }) => activeFeeds.length,
                )}
              />
            }
            href={`#${PRICE_FEEDS_ANCHOR}`}
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
          />
          <AssetClassesCard
            numFeedsByAssetClassPromise={priceFeeds.then(({ activeFeeds }) =>
              getNumFeedsByAssetClass(activeFeeds),
            )}
          />
        </div>
        <Card title="Recently added" icon={<StackPlus />}>
          <FeaturedRecentlyAdded
            placeholderPriceFeedName={<PlaceholderPriceFeedNameAndAssetClass />}
            recentlyAddedPromise={priceFeeds.then(({ activeFeeds }) =>
              filterFeeds(
                activeFeeds,
                priceFeedsStaticConfig.featuredRecentlyAdded,
              ).map(({ product, symbol }) => ({
                id: product.price_account,
                symbol,
                priceFeedName: (
                  <PriceFeedNameAndAssetClass
                    assetClass={product.asset_type.toUpperCase()}
                  >
                    {product.display_symbol}
                  </PriceFeedNameAndAssetClass>
                ),
              })),
            )}
          />
        </Card>
        <Card
          title="Coming soon"
          icon={<ClockCountdown />}
          toolbar={
            <ComingSoonShowAllButton
              comingSoonPromise={priceFeeds.then(({ comingSoon }) =>
                comingSoon.map(({ symbol, product }) => ({
                  symbol,
                  id: product.price_account,
                  displaySymbol: product.display_symbol,
                  assetClassAsString: product.asset_type,
                  priceFeedName: (
                    <PriceFeedNameAndIcon>
                      {product.display_symbol}
                    </PriceFeedNameAndIcon>
                  ),
                  assetClass: (
                    <Badge variant="neutral" style="outline" size="xs">
                      {product.asset_type.toUpperCase()}
                    </Badge>
                  ),
                })),
              )}
            />
          }
        >
          <FeaturedComingSoon
            placeholderPriceFeedName={<PlaceholderPriceFeedNameAndAssetClass />}
            comingSoonPromise={priceFeeds.then(({ comingSoon }) =>
              [
                ...filterFeeds(
                  comingSoon,
                  priceFeedsStaticConfig.featuredComingSoon,
                ),
                ...comingSoon.filter(
                  ({ symbol }) =>
                    !priceFeedsStaticConfig.featuredComingSoon.includes(symbol),
                ),
              ]
                .slice(0, 5)
                .map(({ product }) => ({
                  priceFeedName: (
                    <PriceFeedNameAndAssetClass
                      assetClass={product.asset_type.toUpperCase()}
                    >
                      {product.display_symbol}
                    </PriceFeedNameAndAssetClass>
                  ),
                })),
            )}
          />
        </Card>
        <PriceFeedsCard
          id={PRICE_FEEDS_ANCHOR}
          placeholderPriceFeedName={<PlaceholderPriceFeedNameAndIcon />}
          priceFeedsPromise={priceFeeds.then(({ activeFeeds }) =>
            activeFeeds.map(({ symbol, product, price }) => ({
              symbol,
              id: product.price_account,
              displaySymbol: product.display_symbol,
              assetClassAsString: product.asset_type,
              exponent: price.exponent,
              numPublishers: price.numQuoters,
              weeklySchedule: product.weekly_schedule,
              priceFeedName: (
                <PriceFeedNameAndIcon>
                  {product.display_symbol}
                </PriceFeedNameAndIcon>
              ),
              assetClass: (
                <Badge variant="neutral" style="outline" size="xs">
                  {product.asset_type.toUpperCase()}
                </Badge>
              ),
              priceFeedId: (
                <CopyButton text={toHex(product.price_account)}>
                  {toTruncatedHex(product.price_account)}
                </CopyButton>
              ),
            })),
          )}
        />
      </div>
    </div>
  );
};

const PriceFeedNameAndAssetClass = ({
  children,
  assetClass,
}: {
  children: string;
  assetClass: string;
}) => (
  <div className={styles.priceFeedNameAndAssetClass}>
    <PriceFeedIcon>{children}</PriceFeedIcon>
    <div className={styles.nameAndClass}>
      <PriceFeedName>{children}</PriceFeedName>
      <div className={styles.assetClass}>{assetClass}</div>
    </div>
  </div>
);

const PlaceholderPriceFeedNameAndAssetClass = () => (
  <div className={styles.priceFeedNameAndAssetClass}>
    <div className={styles.priceFeedIcon}>
      <Skeleton round />
    </div>
    <div className={styles.nameAndClass}>
      <div className={styles.priceFeedName}>
        <Skeleton width={20} />
      </div>
      <div className={styles.assetClass}>
        <Skeleton width={10} />
      </div>
    </div>
  </div>
);

const PriceFeedNameAndIcon = ({ children }: { children: string }) => (
  <div className={styles.priceFeedNameAndIcon}>
    <PriceFeedIcon>{children}</PriceFeedIcon>
    <PriceFeedName>{children}</PriceFeedName>
  </div>
);

const PlaceholderPriceFeedNameAndIcon = () => (
  <div className={styles.priceFeedNameAndIcon}>
    <div className={styles.priceFeedIcon}>
      <Skeleton round />
    </div>
    <div className={styles.priceFeedName}>
      <Skeleton width={20} />
    </div>
  </div>
);

const PriceFeedIcon = ({ children }: { children: string }) => {
  const firstPart = children.split("/")[0];
  const Icon = firstPart ? (getIcon(firstPart) ?? Generic) : Generic;

  return (
    <Icon
      className={styles.priceFeedIcon}
      width="100%"
      height="100%"
      viewBox="0 0 32 32"
    />
  );
};

const PriceFeedName = ({ children }: { children: string }) => {
  const [firstPart, ...parts] = children.split("/");

  return (
    <div className={styles.priceFeedName}>
      <span className={styles.firstPart}>{firstPart}</span>
      {parts.map((part, i) => (
        <Fragment key={i}>
          <span className={styles.divider}>/</span>
          <span className={styles.part}>{part}</span>
        </Fragment>
      ))}
    </div>
  );
};

const toHex = (value: string) => toHexString(base58.decode(value));

const toTruncatedHex = (value: string) => {
  const hex = toHex(value);
  return `${hex.slice(0, 6)}...${hex.slice(-4)}`;
};

const toHexString = (byteArray: Uint8Array) =>
  `0x${Array.from(byteArray, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

const getPriceFeeds = async () => {
  const data = await client.getData();
  const priceFeeds = priceFeedsSchema.parse(
    data.symbols.map((symbol) => ({
      symbol,
      product: data.productFromSymbol.get(symbol),
      price: data.productPrice.get(symbol),
    })),
  );
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

const priceFeedsSchema = z.array(
  z.object({
    symbol: z.string(),
    product: z.object({
      display_symbol: z.string(),
      asset_type: z.string(),
      price_account: z.string(),
      weekly_schedule: z.string().optional(),
    }),
    price: z.object({
      exponent: z.number(),
      numQuoters: z.number(),
      minPublishers: z.number(),
    }),
  }),
);

class NoSuchFeedError extends Error {
  constructor(symbol: string) {
    super(`No feed exists named ${symbol}`);
    this.name = "NoSuchFeedError";
  }
}
