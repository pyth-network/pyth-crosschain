import { useAlert } from "@pythnetwork/component-library/useAlert";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined, wait } from "@pythnetwork/shared-lib/util";
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
  const prevSelectedReplayDate = usePrevious(selectedReplayDate);

  /** refs */
  const abortControllerRef = useRef(new AbortController());
  const dataSourcesRef = useRef(dataSources);
  const enabledRef = useRef(enabled);
  const playbackSpeedRef = useRef(playbackSpeed);
  const symbolRef = useRef(symbol);
  const prevSymbolRef = useRef(prevSymbol);
  const selectedReplayDateRef = useRef(selectedReplayDate);
  const prevSelectedReplayDateRef = useRef(prevSelectedReplayDate);
  const isMountedRef = useRef(false);

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);

  /** callbacks */
  const doAbort = useCallback(() => {
    abortControllerRef.current.abort();
  }, []);

  const handleError = useCallback((error_: unknown) => {
    setError(error_ instanceof Error ? error_ : new Error(String(error_)));
  }, []);

  /** effects */
  useEffect(() => {
    dataSourcesRef.current = dataSources;
    enabledRef.current = enabled;
    playbackSpeedRef.current = playbackSpeed;
    prevSymbolRef.current = prevSymbol;
    prevSelectedReplayDateRef.current = prevSelectedReplayDate;
    selectedReplayDateRef.current = selectedReplayDate;
    symbolRef.current = symbol;
  });

  useEffect(() => {
    if (
      !enabled ||
      dataSources.length <= 0 ||
      !selectedReplayDate ||
      !isReplaySymbol(symbol)
    ) {
      doAbort();
      return;
    }

    // Reset the abort controller once per new stream start.
    doAbort();
    abortControllerRef.current = new AbortController();

    /**
     * checks if any of the refs have drifted while we're processing things
     * asynchronously, and if they have, aborts via the abort controller
     * and returns true.
     * Otherwise, returns false
     */
    function guardAbort() {
      const printAborted = (reason: string) => {
        console.info(
          `%caborted processing because ${reason}`,
          "background-color: yellow; color: purple; font-size: 14px; padding: 2px;",
        );
      };
      // if the signal has already been aborted,
      // return early. no point in doing the rest of the checks
      if (abortControllerRef.current.signal.aborted) {
        printAborted("abort controller was already aborted");
        return true;
      }

      // we could collapse this all into a mega ternary,
      // but it's easier for fleshy meatbags a.k.a. humans
      // to read this way
      if (!enabledRef.current) {
        printAborted("enabled is false");
        doAbort();
        return true;
      }
      if (!isReplaySymbol(symbolRef.current)) {
        printAborted(
          `symbol selected is not a replay symbol, ${symbolRef.current ?? "-unset-"}`,
        );
        doAbort();
        return true;
      }
      if (!selectedReplayDateRef.current) {
        printAborted("selected replay date changed is invalid.");
        doAbort();
        return true;
      }
      // if (selectedReplayDateRef.current !== prevSelectedReplayDateRef.current) {
      //   printAborted("current and previous selected replay data are different");
      //   doAbort();
      //   return true;
      // }
      if (dataSourcesRef.current.length <= 0) {
        printAborted("data sources are empty");
        doAbort();
        return true;
      }

      return false;
    }

    let canProcess = true;

    async function doFetch(startAt: string) {
      if (guardAbort()) return;

      const url = getFetchHistoricalUrl(
        dataSourcesRef.current,
        symbolRef.current,
        new Date(startAt),
      );
      const thisData = await fetchHistoricalData(url);
      handleSetIsLoadingInitialReplayData(false);

      while (!canProcess) {
        // wait until the previous consumer frees itself up and then continue
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

        const nextPoint = thisData[i + 1];

        if (guardAbort()) return;

        if (i === quarterPoint) {
          doFetch(nextStartAt).catch(handleError);
        }

        if (guardAbort()) return;

        addDataPoint(
          currPoint.source,
          appendReplaySymbolSuffix(
            currPoint.symbol as AllAllowedSymbols,
          ) as AllowedReplaySymbolsType,
          currPoint,
        );
        if (guardAbort()) return;
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
    void doFetch(selectedReplayDate);

    return () => {
      doAbort();
    };
  }, [
    addDataPoint,
    dataSources,
    doAbort,
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
