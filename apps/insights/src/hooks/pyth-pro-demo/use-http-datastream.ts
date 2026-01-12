import { useAlert } from "@pythnetwork/component-library/useAlert";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import {
  errorToString,
  isNullOrUndefined,
  wait,
} from "@pythnetwork/shared-lib/util";
import { usePrevious } from "@react-hookz/web";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  UseDataStreamReturnType,
  UseHttpDataStreamOpts,
  UseHttpDataStreamReturnType,
} from "./types";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedReplaySymbolsType,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  appendReplaySymbolSuffix,
  removeReplaySymbolSuffix,
  ValidDateSchema,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import type { GetPythHistoricalPricesReturnType } from "../../services/clickhouse-schema";
import { GetPythHistoricalPricesReturnTypeSchema } from "../../services/clickhouse-schema";
import { isReplayDataSource, isReplaySymbol } from "../../util/pyth-pro-demo";

dayjs.extend(utc);

const BASE_FETCH_HISTORICAL_DATA_RETRY_DELAY = 100; // 100 milliseconds

function getFetchHistoricalUrl(
  datasources: AllDataSourcesType[],
  symbol: Nullish<AllAllowedSymbols>,
  startAt: Date,
) {
  const allSourcesAreReplaySources = datasources.every((ds) =>
    isReplayDataSource(ds),
  );

  if (!allSourcesAreReplaySources || !isReplaySymbol(symbol)) {
    return "";
  }
  const startAtValidation = ValidDateSchema.safeParse(startAt);
  if (startAtValidation.error) {
    return "";
  }

  const queryParams = new URLSearchParams();
  queryParams.set("startAt", startAtValidation.data.toISOString());

  for (const datasource of datasources) {
    queryParams.append("datasources[]", datasource);
  }

  return `/api/pyth/get-pyth-feeds-demo-data/${removeReplaySymbolSuffix(symbol)}?${queryParams.toString()}`;
}

export async function fetchHistoricalData(
  url: string,
  maxRetries = 5,
  tryNum = 1,
): Promise<GetPythHistoricalPricesReturnType> {
  try {
    const response = await fetch(url, { method: "GET" });

    const textResponse = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.statusText}: ${textResponse}`);
    }

    if (textResponse.length === 0) {
      throw new Error("Empty response");
    }

    const validated = GetPythHistoricalPricesReturnTypeSchema.safeParse(
      JSON.parse(textResponse),
    );
    if (validated.error) {
      throw new Error(validated.error.message);
    }

    return validated.data;
  } catch (error) {
    if (tryNum >= maxRetries) {
      throw error instanceof Error ? error : new Error("Unknown fetch error");
    }

    const waitDelay = BASE_FETCH_HISTORICAL_DATA_RETRY_DELAY * Math.exp(tryNum);
    const jitter = Math.random() * waitDelay * 0.1;

    await wait(waitDelay + jitter);
    return fetchHistoricalData(url, maxRetries, tryNum + 1);
  }
}

export function useHttpDataStream({
  dataSources,
  enabled,
  symbol,
}: UseHttpDataStreamOpts): UseHttpDataStreamReturnType {
  /** context */
  const {
    addDataPoint,
    handleSetIsLoadingInitialReplayData,
    playbackSpeed,
    selectedReplayDate,
  } = usePythProAppStateContext();

  /** hooks */
  const { open: showAlert } = useAlert();
  const prevSymbol = usePrevious(symbol);

  /** refs */
  const abortControllerRef = useRef(new AbortController());
  const dataSourcesRef = useRef(dataSources);
  const enabledRef = useRef(enabled);
  const playbackSpeedRef = useRef(playbackSpeed);
  const symbolRef = useRef(symbol);
  const prevSymbolRef = useRef(prevSymbol);
  const selectedReplayDateRef = useRef(selectedReplayDate);
  const isMountedRef = useRef(false);

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);

  /** callbacks */
  const handleError = useCallback((error_: unknown) => {
    setError(new Error(errorToString(error_)));
  }, []);

  /** effects */
  useEffect(() => {
    dataSourcesRef.current = dataSources;
    enabledRef.current = enabled;
    playbackSpeedRef.current = playbackSpeed;
    prevSymbolRef.current = prevSymbol;
    selectedReplayDateRef.current = selectedReplayDate;
    symbolRef.current = symbol;
  });

  useEffect(() => {
    // anytime this value changes, we need to abort all current processing
    abortControllerRef.current.abort();
    if (selectedReplayDate) handleSetIsLoadingInitialReplayData(true);
    else handleSetIsLoadingInitialReplayData(false);
  }, [handleSetIsLoadingInitialReplayData, selectedReplayDate]);

  useEffect(() => {
    if (
      !enabled ||
      dataSources.length <= 0 ||
      !selectedReplayDate ||
      !isReplaySymbol(symbol)
    ) {
      return;
    }

    // 1. Create a local controller for THIS specific effect execution
    const controller = new AbortController();
    const signal = controller.signal;

    /**
     * Now accepts the specific signal to check against
     */
    function guardAbort(localSignal: AbortSignal) {
      if (localSignal.aborted) {
        return true;
      }

      if (
        !enabledRef.current ||
        !isReplaySymbol(symbolRef.current) ||
        !selectedReplayDateRef.current ||
        dataSourcesRef.current.length <= 0
      ) {
        controller.abort(); // Abort the local one if refs drifted
        return true;
      }

      return false;
    }

    let canProcess = true;

    async function doFetch(startAt: string, localSignal: AbortSignal) {
      // Pass the localSignal through every recursive call
      if (guardAbort(localSignal)) return;

      const url = getFetchHistoricalUrl(
        dataSourcesRef.current,
        symbolRef.current,
        new Date(startAt),
      );
      const thisData = await fetchHistoricalData(url);
      handleSetIsLoadingInitialReplayData(false);

      while (!canProcess) {
        if (guardAbort(localSignal)) return;
        await wait(10);
      }

      canProcess = false;

      const dataLen = thisData.length;
      const quarterPoint = Math.floor(dataLen / 4);
      const lastPoint = thisData.at(-1);

      const nextStartAt = lastPoint?.timestamp
        ? dayjs(lastPoint.timestamp).add(20, "milliseconds").toISOString()
        : dayjs(startAt).add(1, "minutes").toISOString();

      for (let i = 0; i < dataLen; i++) {
        const currPoint = thisData[i];
        if (isNullOrUndefined(currPoint)) continue;

        if (guardAbort(localSignal)) return;

        if (i === quarterPoint) {
          // Trigger next batch with the SAME signal
          void doFetch(nextStartAt, localSignal).catch(handleError);
        }

        addDataPoint(
          currPoint.source,
          appendReplaySymbolSuffix(
            currPoint.symbol as AllAllowedSymbols,
          ) as AllowedReplaySymbolsType,
          currPoint,
        );

        if (guardAbort(localSignal)) return;

        const nextPoint = thisData[i + 1];
        if (nextPoint) {
          const delta =
            new Date(nextPoint.timestamp).valueOf() -
            new Date(currPoint.timestamp).valueOf();
          await wait(delta / playbackSpeedRef.current);
        }
      }

      canProcess = true;
    }

    if (!isMountedRef.current) {
      setStatus("connected");
      handleSetIsLoadingInitialReplayData(true);
    }

    isMountedRef.current = true;
    void doFetch(selectedReplayDate, signal);

    return () => {
      // This ensures that when the date changes, the signal
      // specific to THIS run is cancelled.
      controller.abort();
    };
  }, [
    addDataPoint,
    dataSources,
    enabled,
    handleError,
    handleSetIsLoadingInitialReplayData,
    selectedReplayDate,
    symbol,
  ]);

  useEffect(() => {
    if (!error) return;

    showAlert({
      contents: error.message,
      title: "Historical data failed to fetch",
    });
  }, [error, showAlert]);

  return { error, status };
}
