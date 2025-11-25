/* eslint-disable no-console */
/* eslint-disable unicorn/no-array-reduce */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { create } from "zustand";

import type {
  AllAllowedSymbols,
  AllAndLatestDataState,
  AllDataSourcesType,
  CurrentPricesStoreState,
  PriceData,
} from "../schemas/pyth/pyth-pro-demo-schema";
import {
  ALL_ALLOWED_SYMBOLS,
  ALL_DATA_SOURCES,
  CurrentPricesStoreStateSchema,
} from "../schemas/pyth/pyth-pro-demo-schema";
import { isAllowedDataSource, isAllowedSymbol } from "../util/pyth-pro-demo";

const emptyDataSourceResults: AllAndLatestDataState = { latest: {} };
const initialState = CurrentPricesStoreStateSchema.safeParse({
  apiTokens: {},
  metrics: ALL_DATA_SOURCES.options.reduce(
    (prev, dataSource) => ({
      ...prev,
      [dataSource]: emptyDataSourceResults,
    }),
    {} satisfies CurrentPricesStoreState["metrics"],
  ),
  selectedSource: ALL_ALLOWED_SYMBOLS.Enum.no_symbol_selected,
} satisfies CurrentPricesStoreState);

if (!initialState.success) {
  throw new Error(
    `pyth-pro-demo-store initial state is malformed: ${initialState.error.message}`,
  );
}

export type PythProStoreType = CurrentPricesStoreState & {
  addDataPoint: (
    dataSource: AllDataSourcesType,
    symbol: AllAllowedSymbols,
    dataPoint: PriceData,
  ) => void;
  handleSelectSource: (source: AllAllowedSymbols) => void;
  updateApiToken: (
    dataSource: AllDataSourcesType,
    apiToken: Nullish<string>,
  ) => void;
};

export const usePythProDemoStore = create<PythProStoreType>()((set) => ({
  ...initialState.data,
  addDataPoint(dataSource, symbol, dataPoint) {
    set((prev) => {
      if (!isAllowedSymbol(symbol) || !isAllowedDataSource(dataSource)) {
        return prev;
      }

      const previousPrice =
        prev.metrics[dataSource]?.latest?.[symbol]?.price ?? dataPoint.price;
      const change = dataPoint.price - previousPrice;
      const changePercent =
        previousPrice > 0 ? (change / previousPrice) * 100 : 0;

      const update: CurrentPricesStoreState = {
        ...prev,
        metrics: {
          [dataSource]: {
            ...prev.metrics[dataSource],
            latest: {
              ...prev.metrics[dataSource]?.latest,
              [symbol]: {
                change,
                changePercent,
                price: dataPoint.price,
                timestamp: dataPoint.timestamp,
              },
            },
          },
        },
      };

      const validate = CurrentPricesStoreStateSchema.safeParse(update);

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
  updateApiToken(dataSource, apiToken) {
    set((prev) => ({
      ...prev,
      apiTokens: {
        ...prev.apiTokens,

        [dataSource]: apiToken,
      },
    }));
  },
}));
