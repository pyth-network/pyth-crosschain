"use client";

import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import clsx from "clsx";
import { type ComponentProps, createContext, use } from "react";
import { useNumberFormatter } from "react-aria";
import { z } from "zod";

import styles from "./index.module.scss";
import { StateType, useData } from "../../use-data";
import { useLivePrice } from "../LivePrices";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const REFRESH_YESTERDAYS_PRICES_INTERVAL = ONE_HOUR_IN_MS;

const CHANGE_PERCENT_SKELETON_WIDTH = 15;

type Props = Omit<ComponentProps<typeof YesterdaysPricesContext>, "value"> & {
  feeds: (Feed & { symbol: string })[];
};

const YesterdaysPricesContext = createContext<
  undefined | ReturnType<typeof useData<Map<string, number>>>
>(undefined);

export const YesterdaysPricesProvider = ({ feeds, ...props }: Props) => {
  const state = useData(
    ["yesterdaysPrices", feeds.map((feed) => feed.symbol)],
    () => getYesterdaysPrices(feeds),
    {
      refreshInterval: REFRESH_YESTERDAYS_PRICES_INTERVAL,
    },
  );

  return <YesterdaysPricesContext value={state} {...props} />;
};

const getYesterdaysPrices = async (
  feeds: (Feed & { symbol: string })[],
): Promise<Map<string, number>> => {
  const url = new URL("/yesterdays-prices", window.location.origin);
  for (const feed of feeds) {
    url.searchParams.append("symbols", feed.symbol);
  }
  const response = await fetch(url);
  const data: unknown = await response.json();
  return new Map(
    Object.entries(yesterdaysPricesSchema.parse(data)).map(
      ([symbol, value]) => [
        feeds.find((feed) => feed.symbol === symbol)?.product.price_account ??
          "",
        value,
      ],
    ),
  );
};

const yesterdaysPricesSchema = z.record(z.string(), z.number());

const useYesterdaysPrices = () => {
  const state = use(YesterdaysPricesContext);

  if (state) {
    return state;
  } else {
    throw new YesterdaysPricesNotInitializedError();
  }
};

type ChangePercentProps = {
  className?: string | undefined;
  feed: Feed;
};

type Feed = {
  product: {
    price_account: string;
  };
};

export const ChangePercent = ({ feed, className }: ChangePercentProps) => {
  const yesterdaysPriceState = useYesterdaysPrices();

  switch (yesterdaysPriceState.type) {
    case StateType.Error: {
      // eslint-disable-next-line unicorn/no-null
      return null;
    }

    case StateType.Loading:
    case StateType.NotLoaded: {
      return (
        <Skeleton
          className={clsx(styles.changePercent, className)}
          width={CHANGE_PERCENT_SKELETON_WIDTH}
        />
      );
    }

    case StateType.Loaded: {
      const yesterdaysPrice = yesterdaysPriceState.data.get(
        feed.product.price_account,
      );
      // eslint-disable-next-line unicorn/no-null
      return yesterdaysPrice === undefined ? null : (
        <ChangePercentLoaded
          className={clsx(styles.changePercent, className)}
          priorPrice={yesterdaysPrice}
          feed={feed}
        />
      );
    }
  }
};

type ChangePercentLoadedProps = {
  className?: string | undefined;
  priorPrice: number;
  feed: Feed;
};

const ChangePercentLoaded = ({
  className,
  priorPrice,
  feed,
}: ChangePercentLoadedProps) => {
  const currentPrice = useLivePrice(feed);

  return currentPrice === undefined ? (
    <Skeleton className={className} width={CHANGE_PERCENT_SKELETON_WIDTH} />
  ) : (
    <PriceDifference
      className={className}
      currentPrice={currentPrice.aggregate.price}
      priorPrice={priorPrice}
    />
  );
};

type PriceDifferenceProps = {
  className?: string | undefined;
  currentPrice: number;
  priorPrice: number;
};

const PriceDifference = ({
  className,
  currentPrice,
  priorPrice,
}: PriceDifferenceProps) => {
  const numberFormatter = useNumberFormatter({ maximumFractionDigits: 2 });
  const direction = getDirection(currentPrice, priorPrice);

  return (
    <span data-direction={direction} className={className}>
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

class YesterdaysPricesNotInitializedError extends Error {
  constructor() {
    super(
      "This component must be contained within a <YesterdaysPricesProvider>",
    );
    this.name = "YesterdaysPricesNotInitializedError";
  }
}
