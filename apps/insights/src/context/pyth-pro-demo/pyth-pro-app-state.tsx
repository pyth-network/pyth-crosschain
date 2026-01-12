/* eslint-disable unicorn/no-array-reduce */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";
import type { IChartApi } from "lightweight-charts";
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

import { useDemoQueryParams } from "../../hooks/pyth-pro-demo";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  CurrentPriceMetrics,
  CurrentPricesStoreState,
  LatestMetric,
  PlaybackSpeed,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  ALL_DATA_SOURCES,
  DATA_SOURCES_CRYPTO,
  DATA_SOURCES_EQUITY,
  DATA_SOURCES_FOREX,
  DATA_SOURCES_HISTORICAL,
  PlaybackSpeedSchema,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import type { PriceData } from "../../services/clickhouse-schema";
import {
  isAllowedCryptoSymbol,
  isAllowedEquitySymbol,
  isAllowedForexSymbol,
  isAllowedSymbol,
  isReplaySymbol,
} from "../../util/pyth-pro-demo";

export type AppStateContextVal = CurrentPricesStoreState & {
  addDataPoint: (
    dataSource: AllDataSourcesType,
    symbol: AllAllowedSymbols,
    dataPoint: PriceData,
  ) => void;

  chartRef: Nullish<IChartApi>;

  dataSourcesInUse: AllDataSourcesType[];

  dataSourceVisibility: Record<AllDataSourcesType, boolean>;

  handleSetChartRef: (chart: Nullish<IChartApi>) => void;

  handleSetIsLoadingInitialReplayData: (isLoading: boolean) => void;

  handleSelectPlaybackSpeed: (speed: PlaybackSpeed) => Promise<void>;

  handleSelectSource: (source: AllAllowedSymbols) => Promise<void>;

  handleSetSelectedReplayDate: (dateStr: string) => Promise<void>;

  handleToggleDataSourceVisibility: (datasource: AllDataSourcesType) => void;

  isLoadingInitialReplayData: boolean;

  playbackSpeed: PlaybackSpeed;

  selectedReplayDate: string;

  selectedSource: AllAllowedSymbols;
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
};

export function PythProAppStateProvider({ children }: PropsWithChildren) {
  /** hooks */
  const {
    playbackSpeed,
    selectedSource,
    startAt: selectedReplayDate,
    updateQuery,
  } = useDemoQueryParams();

  /** state */
  const [appState, setAppState] =
    useState<CurrentPricesStoreState>(initialState);

  const [chartRef, setChartRef] = useState<Nullish<IChartApi>>(undefined);

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

  const [isLoadingInitialReplayData, setIsLoadingInitialReplayData] =
    useState(false);

  /** refs */
  const selectedSymbolRef = useRef(selectedSource);

  /** callbacks */
  const handleSetChartRef = useCallback<
    AppStateContextVal["handleSetChartRef"]
  >((chart) => {
    setChartRef(chart);
  }, []);

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
                  timestamp: dataPoint.timestamp.toISOString(),
                } satisfies CurrentPriceMetrics,
              } satisfies LatestMetric,
            },
          } satisfies CurrentPricesStoreState["metrics"],
        } satisfies CurrentPricesStoreState;
      });
    },
    [],
  );

  const handleSelectSource = useCallback(
    async (source: AllAllowedSymbols) => {
      // delay a few moments to let the http datastream events come down
      // so we don't accidentally kill the new http requests
      // (this is demo code, if we choose to keep this longer term, this will be revised)
      setAppState({
        // blast away all state, because we don't need the old
        // data to be munged with the new data
        ...initialState,
      });

      const selectedSourceIsReplay = isReplaySymbol(source);

      await Promise.all([
        updateQuery(
          "selectedSource",
          isAllowedSymbol(source) ? source : "no_symbol_selected",
        ),
        selectedSourceIsReplay
          ? Promise.resolve()
          : updateQuery("playbackSpeed", undefined),
        selectedSourceIsReplay
          ? Promise.resolve()
          : updateQuery("startAt", undefined),
      ]);
    },
    [updateQuery],
  );

  const handleSelectPlaybackSpeed = useCallback<
    AppStateContextVal["handleSelectPlaybackSpeed"]
  >(
    async (speed) => {
      await updateQuery("playbackSpeed", speed);
    },
    [updateQuery],
  );

  const handleSetSelectedReplayDate = useCallback<
    AppStateContextVal["handleSetSelectedReplayDate"]
  >(
    async (dateStr) => {
      await updateQuery("startAt", dateStr);
    },
    [updateQuery],
  );

  const handleSetIsLoadingInitialReplayData = useCallback<
    AppStateContextVal["handleSetIsLoadingInitialReplayData"]
  >((isLoading) => {
    setIsLoadingInitialReplayData(isLoading);
  }, []);

  /** memos */
  const dataSourcesInUse = useMemo(() => {
    let out: AllDataSourcesType[] = [];
    if (isAllowedCryptoSymbol(selectedSource)) {
      out = Object.values(DATA_SOURCES_CRYPTO.Values);
    } else if (isAllowedForexSymbol(selectedSource)) {
      out = Object.values(DATA_SOURCES_FOREX.Values);
    } else if (isAllowedEquitySymbol(selectedSource)) {
      out = Object.values(DATA_SOURCES_EQUITY.Values);
    } else if (isReplaySymbol(selectedSource)) {
      out = Object.values(DATA_SOURCES_HISTORICAL.Values);
    }
    return out.sort();
  }, [selectedSource]);

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
      chartRef,
      dataSourcesInUse,
      dataSourceVisibility,
      handleSelectPlaybackSpeed,
      handleSelectSource,
      handleSetIsLoadingInitialReplayData,
      handleSetSelectedReplayDate,
      handleSetChartRef,
      handleToggleDataSourceVisibility,
      isLoadingInitialReplayData,
      playbackSpeed: (PlaybackSpeedSchema.safeParse(playbackSpeed).data ??
        1) as PlaybackSpeed,
      selectedReplayDate,
      selectedSource,
    }),
    [
      appState,
      addDataPoint,
      chartRef,
      dataSourcesInUse,
      dataSourceVisibility,
      handleSelectPlaybackSpeed,
      handleSelectSource,
      handleSetIsLoadingInitialReplayData,
      handleSetSelectedReplayDate,
      handleSetChartRef,
      handleToggleDataSourceVisibility,
      isLoadingInitialReplayData,
      playbackSpeed,
      selectedReplayDate,
      selectedSource,
    ],
  );

  /** effects */
  useEffect(() => {
    selectedSymbolRef.current = selectedSource;
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
