/* eslint-disable unicorn/no-array-reduce */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";
import type { PropsWithChildren } from "react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  isReplaySymbol,
} from "../../util/pyth-pro-demo";

type PlaybackSpeed = 1 | 2 | 4 | 8 | 16 | 32;

export type AppStateContextVal = CurrentPricesStoreState & {
  addDataPoint: (
    dataSource: AllDataSourcesType,
    symbol: AllAllowedSymbols,
    dataPoint: PriceData,
  ) => void;

  dataSourcesInUse: AllDataSourcesType[];

  dataSourceVisibility: Record<AllDataSourcesType, boolean>;

  handleSelectPlaybackSpeed: (speed: PlaybackSpeed) => void;

  handleSelectSource: (source: AllAllowedSymbols) => void;

  handleToggleDataSourceVisibility: (datasource: AllDataSourcesType) => void;

  playbackSpeed: PlaybackSpeed;
};

const context = createContext<Nullish<AppStateContextVal>>(undefined);

const initialState: CurrentPricesStoreState = {
  metrics: Object.values(ALL_DATA_SOURCES.Values).reduce(
    (prev, dataSource) => ({
      ...prev,
      [dataSource]: {
        latest: {},
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

  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

  /** refs */
  const selectedSymbolRef = useRef(appState.selectedSource);

  /** callbacks */
  const addDataPoint = useCallback<AppStateContextVal["addDataPoint"]>(
    (dataSource, symbol, dataPoint) => {
      // state is desynchronized, so we disallow setting of the metric here
      if (selectedSymbolRef.current !== symbol) return;

      setAppState((prev) => {
        const previousPrice =
          prev.metrics[dataSource]?.latest?.[symbol]?.price ?? dataPoint.price;
        const change =
          isNumber(dataPoint.price) && isNumber(previousPrice)
            ? dataPoint.price - previousPrice
            : 0;

        let changePercent = 0;
        if (isNumber(previousPrice)) {
          changePercent =
            previousPrice > 0 ? (change / previousPrice) * 100 : 0;
        }

        return {
          ...prev,
          metrics: {
            ...prev.metrics,
            [dataSource]: {
              ...prev.metrics[dataSource],
              latest: {
                ...prev.metrics[dataSource]?.latest,
                [symbol]: {
                  ask: dataPoint.ask,
                  bid: dataPoint.bid,
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

  const handleSelectSource = useCallback((source: AllAllowedSymbols) => {
    // reset playback speed to 1x
    setPlaybackSpeed(1);

    // delay a few moments to let the http datastream events come down
    // so we don't accidentally kill the new http requests
    // (this is demo code, if we choose to keep this longer term, this will be revised)
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
    } else if (isReplaySymbol(appState.selectedSource)) {
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

  const handleSelectPlaybackSpeed = useCallback<
    AppStateContextVal["handleSelectPlaybackSpeed"]
  >((speed) => {
    setPlaybackSpeed(speed);
  }, []);

  /** provider val */
  const providerVal = useMemo<AppStateContextVal>(
    () => ({
      ...appState,
      addDataPoint,
      dataSourcesInUse,
      dataSourceVisibility,
      handleSelectPlaybackSpeed,
      handleSelectSource,
      handleToggleDataSourceVisibility,
      playbackSpeed,
    }),
    [
      appState,
      addDataPoint,
      dataSourcesInUse,
      dataSourceVisibility,
      handleSelectPlaybackSpeed,
      handleSelectSource,
      handleToggleDataSourceVisibility,
      playbackSpeed,
    ],
  );

  /** effects */
  useEffect(() => {
    selectedSymbolRef.current = appState.selectedSource;
  });

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
