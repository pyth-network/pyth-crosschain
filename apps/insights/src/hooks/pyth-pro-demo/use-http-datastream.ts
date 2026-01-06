import { useAlert } from "@pythnetwork/component-library/useAlert";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { wait } from "@pythnetwork/shared-lib/util";
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
  const playbackSpeedRef = useRef(playbackSpeed);
  const symbolRef = useRef(symbol);
  const prevSymbolRef = useRef(prevSymbol);
  const canProcessRef = useRef(true);
  const selectedReplayDateRef = useRef(selectedReplayDate);
  const prevSelectedReplayDateRef = useRef(prevSelectedReplayDate);
  const isMountedRef = useRef(false);

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);
  const [startAtToFetch, setStartAtToFetch] = useState(
    dayjs(selectedReplayDate),
  );

  /** callbacks */
  const handleFetchError = useCallback((error_: unknown) => {
    if (!(error_ instanceof Error)) throw error_;
    setError(error_);
  }, []);
  const processData = useCallback(
    async (data: GetPythHistoricalPricesReturnType) => {
      // if we don't have the greelight to process results,
      // we'll just spin for a while.
      while (!canProcessRef.current) {
        if (
          symbolRef.current !== prevSymbolRef.current ||
          prevSelectedReplayDateRef.current !== selectedReplayDateRef.current
        ) {
          return;
        }
        await wait(10);
      }

      // all the results should be in order of timestamp, regardless of the datasource
      // so we'll just write them all out to the chart as they flow in.

      const dataLen = data.length;
      const quarterPoint = Math.floor(dataLen / 4);
      const lastPoint = data.at(-1);

      for (let i = 0; i < dataLen; i++) {
        canProcessRef.current = false;
        const currPoint = data[i];
        const nextPoint = data[i + 1];

        if (currPoint) {
          const dataPointSymbol = appendReplaySymbolSuffix(
            currPoint.symbol as AllAllowedSymbols,
          );

          if (
            dataPointSymbol !== symbolRef.current ||
            prevSelectedReplayDateRef.current !== selectedReplayDateRef.current
          ) {
            break;
          }

          addDataPoint(currPoint.source, dataPointSymbol, currPoint);
        }

        if (i === quarterPoint) {
          if (lastPoint) {
            setStartAtToFetch(dayjs(lastPoint.timestamp));
          } else {
            // there wasn't any data for this chunk, so just keep adding 1 minute
            // to the request until we get data back
            setStartAtToFetch(dayjs(startAtToFetch).add(1, "minute"));
          }
        }

        if (currPoint && nextPoint) {
          const delta =
            new Date(nextPoint.timestamp).valueOf() -
            new Date(currPoint.timestamp).valueOf();
          await wait(delta / playbackSpeedRef.current);
        }
      }
      canProcessRef.current = true;
    },
    [addDataPoint, startAtToFetch],
  );

  /** effects */
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    prevSymbolRef.current = prevSymbol;
    prevSelectedReplayDateRef.current = prevSelectedReplayDate;
    selectedReplayDateRef.current = selectedReplayDate;
    symbolRef.current = symbol;
  });

  useEffect(() => {
    if (prevSelectedReplayDate !== selectedReplayDate) {
      setStartAtToFetch(dayjs(selectedReplayDate));
    }
  }, [prevSelectedReplayDate, selectedReplayDate]);

  useEffect(() => {
    if (!enabled || !isReplaySymbol(symbol) || !startAtToFetch.isValid()) {
      setStatus("closed");
      return;
    }

    const url = getFetchHistoricalUrl(
      dataSources,
      symbol,
      startAtToFetch.toDate(),
    );
    if (!url) {
      setStatus("closed");
      return;
    }

    setStatus("connected");

    if (!isMountedRef.current) {
      handleSetIsLoadingInitialReplayData(true);
    }

    isMountedRef.current = true;

    fetchHistoricalData(url)
      .then((d) => {
        void processData(d);
      })
      .catch(handleFetchError)
      .finally(() => {
        handleSetIsLoadingInitialReplayData(false);
      });
  }, [
    dataSources,
    enabled,
    handleFetchError,
    handleSetIsLoadingInitialReplayData,
    processData,
    startAtToFetch,
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
