/* eslint-disable unicorn/no-array-reduce */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import type { PropsWithChildren } from "react";
import { createContext, use, useCallback, useMemo, useState } from "react";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  CurrentPriceMetrics,
  CurrentPricesStoreState,
  LatestMetric,
  PriceData,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  ALL_DATA_SOURCES,
  DATA_SOURCES_CRYPTO,
  DATA_SOURCES_EQUITY,
  DATA_SOURCES_FOREX,
  DATA_SOURCES_FUTURES,
  DATA_SOURCES_HISTORICAL,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  isAllowedCryptoSymbol,
  isAllowedEquitySymbol,
  isAllowedForexSymbol,
  isAllowedFutureSymbol,
  isAllowedSymbol,
  isHistoricalSymbol,
} from "../../util/pyth-pro-demo";

export type AppStateContextVal = CurrentPricesStoreState & {
  addDataPoint: (
    dataSource: AllDataSourcesType,
    symbol: AllAllowedSymbols,
    dataPoint: PriceData,
  ) => void;

  addHistoricalDataPoints: (
    dataSource: AllDataSourcesType,
    symbol: AllAllowedSymbols,
    dataPoint: PriceData[],
  ) => void;

  dataSourcesInUse: AllDataSourcesType[];

  dataSourceVisibility: Record<AllDataSourcesType, boolean>;

  handleSelectSource: (source: AllAllowedSymbols) => void;

  handleToggleDataSourceVisibility: (datasource: AllDataSourcesType) => void;
};

const context = createContext<Nullish<AppStateContextVal>>(undefined);

const initialState: CurrentPricesStoreState = {
  metrics: Object.values(ALL_DATA_SOURCES.Values).reduce(
    (prev, dataSource) => ({
      ...prev,
      [dataSource]: {
        latest: {},
        historical: {},
      } satisfies CurrentPricesStoreState["metrics"]["binance"],
    }),
    {} satisfies CurrentPricesStoreState["metrics"],
  ),
  selectedSource: "no_symbol_selected",
};

export function PythProAppStateProvider({ children }: PropsWithChildren) {
  /** state */
  const [appState, setAppState] =
    useState<CurrentPricesStoreState>(initialState);

  const [dataSourceVisibility, setDataSourceVisibility] = useState<
    AppStateContextVal["dataSourceVisibility"]
  >(
    ALL_DATA_SOURCES.options.reduce(
      (prev, datasource) => ({
        ...prev,
        [datasource]: true,
      }),
      {} as AppStateContextVal["dataSourceVisibility"],
    ),
  );

  /** callbacks */
  const addDataPoint = useCallback<AppStateContextVal["addDataPoint"]>(
    (dataSource, symbol, dataPoint) => {
      setAppState((prev) => {
        const previousPrice =
          prev.metrics[dataSource]?.latest?.[symbol]?.price ?? dataPoint.price;
        const change = dataPoint.price - previousPrice;
        const changePercent =
          previousPrice > 0 ? (change / previousPrice) * 100 : 0;

        return {
          ...prev,
          metrics: {
            ...prev.metrics,
            [dataSource]: {
              ...prev.metrics[dataSource],
              latest: {
                ...prev.metrics[dataSource]?.latest,
                [symbol]: {
                  change,
                  changePercent,
                  price: dataPoint.price,
                  timestamp: dataPoint.timestamp,
                } satisfies CurrentPriceMetrics,
              } satisfies LatestMetric,
            },
          } satisfies CurrentPricesStoreState["metrics"],
        } satisfies CurrentPricesStoreState;
      });
    },
    [],
  );

  const addHistoricalDataPoints = useCallback<
    AppStateContextVal["addHistoricalDataPoints"]
  >((dataSource, symbol, dataPoints) => {
    setAppState((prev) => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        [dataSource]: {
          ...prev.metrics[dataSource],
          historical: {
            ...prev.metrics[dataSource]?.historical,
            [symbol]: [
              ...(prev.metrics[dataSource]?.historical?.[symbol] ?? []),
              ...dataPoints,
            ],
          },
        },
      },
    }));
  }, []);

  const handleSelectSource = useCallback((source: AllAllowedSymbols) => {
    setAppState({
      // blast away all state, because we don't need the old
      // data to be munged with the new data
      ...initialState,
      selectedSource: isAllowedSymbol(source) ? source : undefined,
    });
  }, []);

  /** memos */
  const dataSourcesInUse = useMemo(() => {
    let out: AllDataSourcesType[] = [];
    if (isAllowedCryptoSymbol(appState.selectedSource)) {
      out = Object.values(DATA_SOURCES_CRYPTO.Values);
    } else if (isAllowedForexSymbol(appState.selectedSource)) {
      out = Object.values(DATA_SOURCES_FOREX.Values);
    } else if (isAllowedEquitySymbol(appState.selectedSource)) {
      out = Object.values(DATA_SOURCES_EQUITY.Values);
    } else if (isAllowedFutureSymbol(appState.selectedSource)) {
      out = Object.values(DATA_SOURCES_FUTURES.Values);
    } else if (isHistoricalSymbol(appState.selectedSource)) {
      out = Object.values(DATA_SOURCES_HISTORICAL.Values);
    }
    return out.sort();
  }, [appState.selectedSource]);

  const handleToggleDataSourceVisibility = useCallback<
    AppStateContextVal["handleToggleDataSourceVisibility"]
  >((datasource) => {
    setDataSourceVisibility((prev) => ({
      ...prev,
      [datasource]: !prev[datasource],
    }));
  }, []);

  /** provider val */
  const providerVal = useMemo<AppStateContextVal>(
    () => ({
      ...appState,
      addDataPoint,
      addHistoricalDataPoints,
      dataSourcesInUse,
      dataSourceVisibility,
      handleSelectSource,
      handleToggleDataSourceVisibility,
    }),
    [
      appState,
      addDataPoint,
      addHistoricalDataPoints,
      dataSourcesInUse,
      dataSourceVisibility,
      handleSelectSource,
      handleToggleDataSourceVisibility,
    ],
  );

  return <context.Provider value={providerVal}>{children}</context.Provider>;
}

export function usePythProAppStateContext() {
  const ctx = use(context);
  if (!ctx) {
    throw new Error(
      "unable to useAppStateContext() because no <AppStateProvider /> was found in the parent tree",
    );
  }

  return ctx;
}
