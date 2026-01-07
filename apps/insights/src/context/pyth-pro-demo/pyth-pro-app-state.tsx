/* eslint-disable unicorn/no-array-reduce */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  ALL_ALLOWED_SYMBOLS,
  ALL_DATA_SOURCES,
  DATA_SOURCES_CRYPTO,
  DATA_SOURCES_EQUITY,
  DATA_SOURCES_FOREX,
  DATA_SOURCES_FUTURES,
  DATA_SOURCES_HISTORICAL,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import type { PriceData } from "../../services/clickhouse-schema";
import {
  isAllowedCryptoSymbol,
  isAllowedEquitySymbol,
  isAllowedForexSymbol,
  isAllowedFutureSymbol,
  isAllowedSymbol,
  isReplaySymbol,
} from "../../util/pyth-pro-demo";

const QUERY_PARAM_START_AT = "startAt";
const QUERY_PARAM_PLAYBACK_SPEED = "playbackSpeed";
const QUERY_PARAM_SELECTED_SOURCE = "selectedSource";

type PlaybackSpeed = 1 | 2 | 4 | 8 | 16 | 32;
const ALLOWED_PLAYBACK_SPEEDS = new Set<PlaybackSpeed>([1, 2, 4, 8, 16, 32]);

export type AppStateContextVal = CurrentPricesStoreState & {
  addDataPoint: (
    dataSource: AllDataSourcesType,
    symbol: AllAllowedSymbols,
    dataPoint: PriceData,
  ) => void;

  dataSourcesInUse: AllDataSourcesType[];

  dataSourceVisibility: Record<AllDataSourcesType, boolean>;

  handleSetIsLoadingInitialReplayData: (isLoading: boolean) => void;

  handleSelectPlaybackSpeed: (speed: PlaybackSpeed) => void;

  handleSelectSource: (source: AllAllowedSymbols) => void;

  handleSetSelectedReplayDate: (dateStr: string) => void;

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

function updateQueryString({
  existingQuery,
  pathname,
  queryKey,
  router,
  val,
}: {
  existingQuery: string;
  pathname: string;
  queryKey: string;
  router: ReturnType<typeof useRouter>;
  val: string;
}) {
  const existing = new URLSearchParams(existingQuery);

  if (val) {
    existing.set(queryKey, val);
  } else {
    existing.delete(queryKey);
  }
  const updatedQuery = existing.toString();
  router.push(`${pathname}?${updatedQuery}`);

  return updatedQuery;
}

export function PythProAppStateProvider({ children }: PropsWithChildren) {
  /** hooks */
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  /** local variables */
  const selectedReplayDate = searchParams.get(QUERY_PARAM_START_AT) ?? "";
  const playbackSpeed = Number(
    searchParams.get(QUERY_PARAM_PLAYBACK_SPEED) ?? "1",
  );
  const validatedSelectedSource = ALL_ALLOWED_SYMBOLS.safeParse(
    searchParams.get(QUERY_PARAM_SELECTED_SOURCE),
  );
  const selectedSource = validatedSelectedSource.data ?? "no_symbol_selected";

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

  const [isLoadingInitialReplayData, setIsLoadingInitialReplayData] =
    useState(false);

  /** refs */
  const selectedSymbolRef = useRef(selectedSource);

  /** callbacks */
  const setPlaybackSpeed = useCallback(
    (speed: PlaybackSpeed) => {
      updateQueryString({
        existingQuery: searchParams.toString(),
        pathname,
        queryKey: QUERY_PARAM_PLAYBACK_SPEED,
        router,
        val: speed.toString(),
      });
    },
    [pathname, router, searchParams],
  );
  const setSelectedReplayDate = useCallback(
    (dateStr: string) => {
      updateQueryString({
        existingQuery: searchParams.toString(),
        pathname,
        queryKey: QUERY_PARAM_START_AT,
        router,
        val: dateStr,
      });
    },
    [pathname, router, searchParams],
  );

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
    (source: AllAllowedSymbols) => {
      // reset playback speed to 1x
      setPlaybackSpeed(1);

      // delay a few moments to let the http datastream events come down
      // so we don't accidentally kill the new http requests
      // (this is demo code, if we choose to keep this longer term, this will be revised)
      setAppState({
        // blast away all state, because we don't need the old
        // data to be munged with the new data
        ...initialState,
      });
      let query = updateQueryString({
        existingQuery: searchParams.toString(),
        pathname,
        queryKey: QUERY_PARAM_SELECTED_SOURCE,
        router,
        val: isAllowedSymbol(source) ? source : "",
      });
      if (!isReplaySymbol(source)) {
        query = updateQueryString({
          existingQuery: query,
          pathname,
          queryKey: QUERY_PARAM_PLAYBACK_SPEED,
          router,
          val: "",
        });
        updateQueryString({
          existingQuery: query,
          pathname,
          queryKey: QUERY_PARAM_START_AT,
          router,
          val: "",
        });
      }
    },
    [pathname, router, searchParams, setPlaybackSpeed],
  );

  const handleSelectPlaybackSpeed = useCallback<
    AppStateContextVal["handleSelectPlaybackSpeed"]
  >(
    (speed) => {
      setPlaybackSpeed(speed);
    },
    [setPlaybackSpeed],
  );

  const handleSetSelectedReplayDate = useCallback<
    AppStateContextVal["handleSetSelectedReplayDate"]
  >(
    (dateStr) => {
      setSelectedReplayDate(dateStr);
    },
    [setSelectedReplayDate],
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
    } else if (isAllowedFutureSymbol(selectedSource)) {
      out = Object.values(DATA_SOURCES_FUTURES.Values);
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
      dataSourcesInUse,
      dataSourceVisibility,
      handleSelectPlaybackSpeed,
      handleSelectSource,
      handleSetIsLoadingInitialReplayData,
      handleSetSelectedReplayDate,
      handleToggleDataSourceVisibility,
      isLoadingInitialReplayData,
      playbackSpeed: (ALLOWED_PLAYBACK_SPEEDS.has(
        playbackSpeed as PlaybackSpeed,
      )
        ? playbackSpeed
        : 1) as PlaybackSpeed,
      selectedReplayDate,
      selectedSource,
    }),
    [
      appState,
      addDataPoint,
      dataSourcesInUse,
      dataSourceVisibility,
      handleSelectPlaybackSpeed,
      handleSelectSource,
      handleSetIsLoadingInitialReplayData,
      handleSetSelectedReplayDate,
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
