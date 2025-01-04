"use client";

import { type ComponentProps, createContext, use } from "react";
import { useNumberFormatter } from "react-aria";
import { z } from "zod";

import { StateType, useData } from "../../use-data";
import { ChangeValue } from "../ChangeValue";
import { useLivePrice } from "../LivePrices";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const REFRESH_YESTERDAYS_PRICES_INTERVAL = ONE_HOUR_IN_MS;

type Props = Omit<ComponentProps<typeof YesterdaysPricesContext>, "value"> & {
  feeds: Record<string, string>;
};

const YesterdaysPricesContext = createContext<
  undefined | ReturnType<typeof useData<Map<string, number>>>
>(undefined);

export const YesterdaysPricesProvider = ({ feeds, ...props }: Props) => {
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
  feeds: Props["feeds"],
): Promise<Map<string, number>> => {
  const url = new URL("/yesterdays-prices", window.location.origin);
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

type ChangePercentProps = {
  className?: string | undefined;
  feedKey: string;
};

export const ChangePercent = ({ feedKey, className }: ChangePercentProps) => {
  const yesterdaysPriceState = useYesterdaysPrices();

  switch (yesterdaysPriceState.type) {
    case StateType.Error:
    case StateType.Loading:
    case StateType.NotLoaded: {
      return <ChangeValue className={className} isLoading />;
    }

    case StateType.Loaded: {
      const yesterdaysPrice = yesterdaysPriceState.data.get(feedKey);
      return yesterdaysPrice === undefined ? (
        <ChangeValue className={className} isLoading />
      ) : (
        <ChangePercentLoaded
          className={className}
          priorPrice={yesterdaysPrice}
          feedKey={feedKey}
        />
      );
    }
  }
};

type ChangePercentLoadedProps = {
  className?: string | undefined;
  priorPrice: number;
  feedKey: string;
};

const ChangePercentLoaded = ({
  className,
  priorPrice,
  feedKey,
}: ChangePercentLoadedProps) => {
  const { current } = useLivePrice(feedKey);

  return current === undefined ? (
    <ChangeValue className={className} isLoading />
  ) : (
    <PriceDifference
      className={className}
      currentPrice={current.aggregate.price}
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
    <ChangeValue direction={direction} className={className}>
      {numberFormatter.format(
        (100 * Math.abs(currentPrice - priorPrice)) / priorPrice,
      )}
      %
    </ChangeValue>
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
