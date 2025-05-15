"use client";

import { StateType, useData } from "@pythnetwork/component-library/useData";
import type { ComponentProps } from "react";
import { createContext, use } from "react";
import { z } from "zod";

import { useLivePriceData } from "../../hooks/use-live-price-data";
import { Cluster } from "../../services/pyth";
import { ChangePercent } from "../ChangePercent";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const REFRESH_YESTERDAYS_PRICES_INTERVAL = ONE_HOUR_IN_MS;

type YesterdaysPricesProviderProps = Omit<
  ComponentProps<typeof YesterdaysPricesContext>,
  "value"
> & {
  feeds: Record<string, string>;
};

const YesterdaysPricesContext = createContext<
  undefined | ReturnType<typeof useData<Map<string, number>>>
>(undefined);

export const YesterdaysPricesProvider = ({
  feeds,
  ...props
}: YesterdaysPricesProviderProps) => {
  const state = useData(
    ["yesterdaysPrices", Object.keys(feeds)],
    () => getYesterdaysPrices(feeds),
    {
      refreshInterval: REFRESH_YESTERDAYS_PRICES_INTERVAL,
    },
  );

  return <YesterdaysPricesContext value={state} {...props} />;
};

const getYesterdaysPrices = async (
  feeds: YesterdaysPricesProviderProps["feeds"],
): Promise<Map<string, number>> => {
  const url = new URL("/yesterdays-prices", globalThis.location.origin);
  for (const symbol of Object.keys(feeds)) {
    url.searchParams.append("symbols", symbol);
  }
  const response = await fetch(url);
  const data = yesterdaysPricesSchema.parse(await response.json());
  return new Map(
    Object.entries(data).map(([symbol, value]) => [feeds[symbol] ?? "", value]),
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

type Props = {
  className?: string | undefined;
  feedKey: string;
};

export const PriceFeedChangePercent = ({ feedKey, className }: Props) => {
  const yesterdaysPriceState = useYesterdaysPrices();

  switch (yesterdaysPriceState.type) {
    case StateType.Error:
    case StateType.Loading:
    case StateType.NotLoaded: {
      return <ChangePercent className={className} isLoading />;
    }

    case StateType.Loaded: {
      const yesterdaysPrice = yesterdaysPriceState.data.get(feedKey);
      return yesterdaysPrice === undefined ? (
        <ChangePercent className={className} isLoading />
      ) : (
        <PriceFeedChangePercentLoaded
          className={className}
          priorPrice={yesterdaysPrice}
          feedKey={feedKey}
        />
      );
    }
  }
};

type PriceFeedChangePercentLoadedProps = {
  className?: string | undefined;
  priorPrice: number;
  feedKey: string;
};

const PriceFeedChangePercentLoaded = ({
  className,
  priorPrice,
  feedKey,
}: PriceFeedChangePercentLoadedProps) => {
  const { current } = useLivePriceData(Cluster.Pythnet, feedKey);

  return current === undefined ? (
    <ChangePercent className={className} isLoading />
  ) : (
    <ChangePercent
      className={className}
      currentValue={current.aggregate.price}
      previousValue={priorPrice}
    />
  );
};

class YesterdaysPricesNotInitializedError extends Error {
  constructor() {
    super(
      "This component must be contained within a <YesterdaysPricesProvider>",
    );
    this.name = "YesterdaysPricesNotInitializedError";
  }
}
