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
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import base58 from "bs58";
import clsx from "clsx";
import Generic from "cryptocurrency-icons/svg/color/generic.svg";
import { Fragment, type ElementType } from "react";
import { z } from "zod";

import { AssetClassesDrawer } from "./asset-classes-drawer";
import { YesterdaysPricesProvider, ChangePercent } from "./change-percent";
import { ComingSoonList } from "./coming-soon-list";
import styles from "./index.module.scss";
import { PriceFeedsCard } from "./price-feeds-card";
import { getIcon } from "../../icons";
import { client } from "../../services/pyth";
import { priceFeeds as priceFeedsStaticConfig } from "../../static-data/price-feeds";
import { CopyButton } from "../CopyButton";
import { LivePrice } from "../LivePrices";

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
        <div className={styles.stats}>
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
        </div>
        <YesterdaysPricesProvider
          symbolsToFeedKeys={Object.fromEntries(
            featuredRecentlyAdded.map(({ symbol, product }) => [
              symbol,
              product.price_account,
            ]),
          )}
        >
          <FeaturedFeedsCard
            title="Recently added"
            icon={<StackPlus />}
            feeds={featuredRecentlyAdded}
            showPrices
            linkFeeds
          />
        </YesterdaysPricesProvider>
        <FeaturedFeedsCard
          title="Coming soon"
          icon={<ClockCountdown />}
          feeds={featuredComingSoon}
          toolbar={
            <DrawerTrigger>
              <Button size="xs" variant="outline">
                Show all
              </Button>
              <Drawer
                className={styles.comingSoonCard ?? ""}
                title={
                  <>
                    <span>Coming Soon</span>
                    <Badge>{priceFeeds.comingSoon.length}</Badge>
                  </>
                }
              >
                <ComingSoonList
                  comingSoonFeeds={priceFeeds.comingSoon.map(
                    ({ symbol, product }) => ({
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
                    }),
                  )}
                />
              </Drawer>
            </DrawerTrigger>
          }
        />
        <PriceFeedsCard
          id={PRICE_FEEDS_ANCHOR}
          nameLoadingSkeleton={
            <div className={styles.priceFeedNameAndIcon}>
              <Skeleton
                className={clsx(styles.priceFeedIcon, styles.skeleton)}
                fill
              />
              <div className={styles.priceFeedName}>
                <Skeleton width={20} />
              </div>
            </div>
          }
          priceFeeds={priceFeeds.activeFeeds.map(
            ({ symbol, product, price }) => ({
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
                <CopyButton
                  className={styles.priceFeedId ?? ""}
                  text={toHex(product.price_account)}
                >
                  {toTruncatedHex(product.price_account)}
                </CopyButton>
              ),
            }),
          )}
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
      {feeds.map(({ product }) => (
        <Card
          key={product.price_account}
          variant="tertiary"
          {...(linkFeeds && { href: "#" })}
        >
          <div className={styles.feedCardContents}>
            <div className={styles.priceFeedNameAndDescription}>
              <PriceFeedIcon>{product.display_symbol}</PriceFeedIcon>
              <div className={styles.nameAndDescription}>
                <PriceFeedName>{product.display_symbol}</PriceFeedName>
                <div className={styles.description}>
                  {product.description.split("/")[0]}
                </div>
              </div>
            </div>
            {showPrices && (
              <div className={styles.prices}>
                <LivePrice account={product.price_account} />
                <ChangePercent feedKey={product.price_account} />
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  </Card>
);

const PriceFeedNameAndIcon = ({ children }: { children: string }) => (
  <div className={styles.priceFeedNameAndIcon}>
    <PriceFeedIcon>{children}</PriceFeedIcon>
    <PriceFeedName>{children}</PriceFeedName>
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
      description: z.string(),
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
