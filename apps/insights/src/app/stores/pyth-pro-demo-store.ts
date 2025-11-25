/* eslint-disable no-console */
/* eslint-disable unicorn/no-array-reduce */
import { createStore } from "zustand";

import type {
  AllAllowedSymbols,
  AllAndLatestDataState,
  AllDataSourcesType,
  CurrentPriceMetrics,
  CurrentPricesStoreState,
  LatestMetric,
  PriceData,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  ALL_ALLOWED_SYMBOLS,
  ALL_DATA_SOURCES,
  CurrentPricesStoreStateSchema,
} from "../../schemas/pyth/pyth-pro-demo-schema";

const emptyDataSourceResults: AllAndLatestDataState = { latest: {} };
const initialState = CurrentPricesStoreStateSchema.safeParse(
  ALL_DATA_SOURCES.options.reduce(
    (prev, dataSource) => ({
      ...prev,
      [dataSource]: emptyDataSourceResults,
    }),
    {
      selectedSource: ALL_ALLOWED_SYMBOLS.Enum.no_symbol_selected,
    } satisfies CurrentPricesStoreState,
  ),
);

if (!initialState.success) {
  throw new Error(`pyth-pro-demo-store initial state is malformed`);
}

export type PythProStoreType = CurrentPricesStoreState & {
  addDataPoint: (
    dataSource: AllDataSourcesType,
    symbol: AllAllowedSymbols,
    dataPoint: PriceData,
  ) => void;
  handleSelectSource: (source: AllAllowedSymbols) => void;
};

export const usePythProDemoStore = createStore<PythProStoreType>()((set) => ({
  ...initialState.data,
  addDataPoint(dataSource, symbol, dataPoint) {
    set((prev) => {
      const previousPrice =
        prev[dataSource]?.latest?.[symbol]?.price ?? dataPoint.price;
      const change = dataPoint.price - previousPrice;
      const changePercent =
        previousPrice > 0 ? (change / previousPrice) * 100 : 0;

      const validate = CurrentPricesStoreStateSchema.safeParse({
        ...prev,
        [dataSource]: {
          ...prev[dataSource],
          latest: {
            ...prev[dataSource]?.latest,
            [symbol]: {
              change,
              changePercent,
              price: dataPoint.price,
              timestamp: dataPoint.timestamp,
            } satisfies CurrentPriceMetrics,
          } satisfies LatestMetric,
        } satisfies AllAndLatestDataState,
      } satisfies CurrentPricesStoreState);

      if (validate.success) return validate.data;

      console.error(
        `failed to addDataPoint() to store. please see warning, below:`,
      );
      console.error(validate.error.flatten());
      return prev;
    });
  },
  handleSelectSource(selectedSource) {
    set({
      ...initialState.data,
      selectedSource,
    });
  },
}));
