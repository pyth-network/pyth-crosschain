"use client";

import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { Card } from "@pythnetwork/component-library/Card";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { type ReactNode, Suspense, use, useMemo } from "react";
import { useNumberFormatter } from "react-aria";
import { z } from "zod";

import styles from "./featured-recently-added.module.scss";
import { StateType, useData } from "../../use-data";
import { SKELETON_WIDTH, LivePrice, useLivePrice } from "../LivePrices";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const REFRESH_YESTERDAYS_PRICES_INTERVAL = ONE_HOUR_IN_MS;

const CHANGE_PERCENT_SKELETON_WIDTH = 15;

type Props = {
  placeholderPriceFeedName: ReactNode;
  recentlyAddedPromise: Promise<RecentlyAddedPriceFeed[]>;
};

type RecentlyAddedPriceFeed = {
  id: string;
  symbol: string;
  priceFeedName: ReactNode;
};

export const FeaturedRecentlyAdded = ({
  placeholderPriceFeedName,
  recentlyAddedPromise,
}: Props) => (
  <div className={styles.featuredRecentlyAdded}>
    <Suspense
      fallback={
        <Placeholder placeholderPriceFeedName={placeholderPriceFeedName} />
      }
    >
      <ResolvedFeaturedRecentlyAdded
        recentlyAddedPromise={recentlyAddedPromise}
      />
    </Suspense>
  </div>
);

type PlaceholderProps = {
  placeholderPriceFeedName: ReactNode;
};

const Placeholder = ({ placeholderPriceFeedName }: PlaceholderProps) => (
  <>
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
  </>
);

const PlaceholderCard = ({ placeholderPriceFeedName }: PlaceholderProps) => (
  <Card
    title={placeholderPriceFeedName}
    footer={
      <Footer
        price={<Skeleton width={SKELETON_WIDTH} />}
        changePercent={<Skeleton width={CHANGE_PERCENT_SKELETON_WIDTH} />}
      />
    }
    {...sharedCardProps}
  />
);

type ResolvedFeaturedRecentlyAddedProps = {
  recentlyAddedPromise: Promise<RecentlyAddedPriceFeed[]>;
};

const ResolvedFeaturedRecentlyAdded = ({
  recentlyAddedPromise,
}: ResolvedFeaturedRecentlyAddedProps) => {
  const recentlyAdded = use(recentlyAddedPromise);
  const feedKeys = useMemo(
    () => recentlyAdded.map(({ id }) => id),
    [recentlyAdded],
  );
  const symbols = useMemo(
    () => recentlyAdded.map(({ symbol }) => symbol),
    [recentlyAdded],
  );
  const state = useData(
    ["yesterdaysPrices", feedKeys],
    () => getYesterdaysPrices(symbols),
    {
      refreshInterval: REFRESH_YESTERDAYS_PRICES_INTERVAL,
    },
  );

  return (
    <>
      {recentlyAdded.map(({ priceFeedName, id, symbol }, i) => (
        <Card
          key={i}
          href="#"
          title={priceFeedName}
          footer={
            <Footer
              price={<LivePrice account={id} />}
              changePercent={
                <ChangePercent
                  yesterdaysPriceState={state}
                  feedKey={id}
                  symbol={symbol}
                />
              }
            />
          }
          {...sharedCardProps}
        />
      ))}
    </>
  );
};

type FooterProps = {
  price: ReactNode;
  changePercent: ReactNode;
};

const Footer = ({ price, changePercent }: FooterProps) => (
  <div className={styles.footer}>
    {price}
    <div className={styles.changePercent}>{changePercent}</div>
  </div>
);

const sharedCardProps = {
  className: styles.recentlyAddedFeed,
  variant: "tertiary" as const,
};

const getYesterdaysPrices = async (
  symbols: string[],
): Promise<Record<string, number>> => {
  const url = new URL("/yesterdays-prices", window.location.origin);
  for (const symbol of symbols) {
    url.searchParams.append("symbols", symbol);
  }
  const response = await fetch(url);
  const data: unknown = await response.json();
  return yesterdaysPricesSchema.parse(data);
};

const yesterdaysPricesSchema = z.record(z.string(), z.number());

type ChangePercentProps = {
  yesterdaysPriceState: ReturnType<
    typeof useData<Awaited<ReturnType<typeof getYesterdaysPrices>>>
  >;
  feedKey: string;
  symbol: string;
};

const ChangePercent = ({
  yesterdaysPriceState,
  feedKey,
  symbol,
}: ChangePercentProps) => {
  switch (yesterdaysPriceState.type) {
    case StateType.Error: {
      // eslint-disable-next-line unicorn/no-null
      return null;
    }

    case StateType.Loading:
    case StateType.NotLoaded: {
      return <Skeleton width={CHANGE_PERCENT_SKELETON_WIDTH} />;
    }

    case StateType.Loaded: {
      const yesterdaysPrice = yesterdaysPriceState.data[symbol];
      // eslint-disable-next-line unicorn/no-null
      return yesterdaysPrice === undefined ? null : (
        <ChangePercentLoaded priorPrice={yesterdaysPrice} feedKey={feedKey} />
      );
    }
  }
};

type ChangePercentLoadedProps = {
  priorPrice: number;
  feedKey: string;
};

const ChangePercentLoaded = ({
  priorPrice,
  feedKey,
}: ChangePercentLoadedProps) => {
  const currentPrice = useLivePrice(feedKey);

  return currentPrice === undefined ? (
    <Skeleton width={CHANGE_PERCENT_SKELETON_WIDTH} />
  ) : (
    <PriceDifference
      currentPrice={currentPrice.price}
      priorPrice={priorPrice}
    />
  );
};

type PriceDifferenceProps = {
  currentPrice: number;
  priorPrice: number;
};

const PriceDifference = ({
  currentPrice,
  priorPrice,
}: PriceDifferenceProps) => {
  const numberFormatter = useNumberFormatter({ maximumFractionDigits: 2 });
  const direction = getDirection(currentPrice, priorPrice);

  return (
    <span data-direction={direction} className={styles.price}>
      <CaretUp weight="fill" className={styles.caret} />
      {numberFormatter.format(
        (100 * Math.abs(currentPrice - priorPrice)) / currentPrice,
      )}
      %
    </span>
  );
};

const getDirection = (currentPrice: number, priorPrice: number) => {
  if (currentPrice < priorPrice) {
    return "down";
  } else if (currentPrice > priorPrice) {
    return "up";
  } else {
    return "flat";
  }
};
