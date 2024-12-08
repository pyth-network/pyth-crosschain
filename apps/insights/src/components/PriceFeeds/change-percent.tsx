"use client";

import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { type ComponentProps, createContext, use } from "react";
import { useNumberFormatter } from "react-aria";
import { z } from "zod";

import styles from "./change-percent.module.scss";
import { StateType, useData } from "../../use-data";
import { useLivePrice } from "../LivePrices";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const REFRESH_YESTERDAYS_PRICES_INTERVAL = ONE_HOUR_IN_MS;

const CHANGE_PERCENT_SKELETON_WIDTH = 15;

type Props = Omit<ComponentProps<typeof YesterdaysPricesContext>, "value"> & {
  symbolsToFeedKeys: Record<string, string>;
};

const YesterdaysPricesContext = createContext<
  undefined | ReturnType<typeof useData<Map<string, number>>>
>(undefined);

export const YesterdaysPricesProvider = ({
  symbolsToFeedKeys,
  ...props
}: Props) => {
  const state = useData(
    ["yesterdaysPrices", Object.values(symbolsToFeedKeys)],
    () => getYesterdaysPrices(symbolsToFeedKeys),
    {
      refreshInterval: REFRESH_YESTERDAYS_PRICES_INTERVAL,
    },
  );

  return <YesterdaysPricesContext value={state} {...props} />;
};

const getYesterdaysPrices = async (
  symbolsToFeedKeys: Record<string, string>,
): Promise<Map<string, number>> => {
  const url = new URL("/yesterdays-prices", window.location.origin);
  for (const symbol of Object.keys(symbolsToFeedKeys)) {
    url.searchParams.append("symbols", symbol);
  }
  const response = await fetch(url);
  const data: unknown = await response.json();
  return new Map(
    Object.entries(yesterdaysPricesSchema.parse(data)).map(
      ([symbol, value]) => [symbolsToFeedKeys[symbol] ?? "", value],
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
  feedKey: string;
};

export const ChangePercent = ({ feedKey }: ChangePercentProps) => {
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
          className={styles.changePercent}
          width={CHANGE_PERCENT_SKELETON_WIDTH}
        />
      );
    }

    case StateType.Loaded: {
      const yesterdaysPrice = yesterdaysPriceState.data.get(feedKey);
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
    <Skeleton
      className={styles.changePercent}
      width={CHANGE_PERCENT_SKELETON_WIDTH}
    />
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
    <span data-direction={direction} className={styles.changePercent}>
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
