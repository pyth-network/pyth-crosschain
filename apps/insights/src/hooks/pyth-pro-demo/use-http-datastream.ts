/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { useAlert } from "@pythnetwork/component-library/useAlert";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined, wait } from "@pythnetwork/shared-lib/util";
import { useIsMounted } from "@react-hookz/web";
import { useEffect, useRef, useState } from "react";

import type {
  UseDataStreamReturnType,
  UseHttpDataStreamOpts,
  UseHttpDataStreamReturnType,
} from "./types";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  HistoricalDataResponseType,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  HistoricalDataResponseSchema,
  removeReplaySymbolSuffix,
  ValidDateSchema,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { isReplayDataSource, isReplaySymbol } from "../../util/pyth-pro-demo";

const BASE_FETCH_HISTORICAL_DATA_RETRY_DELAY = 100; // 100 milliseconds

// 🚨 DEMO HACK ALERT: we pick some point into trading
// to ensure all APIs have saturated query results
const INITIAL_START_AT = new Date("2025-12-05T19:00:00.000Z");

function getFetchHistoricalUrl(
  datasource: Nullish<AllDataSourcesType>,
  symbol: Nullish<AllAllowedSymbols>,
  startAt: Date,
) {
  if (!isReplayDataSource(datasource) || !isReplaySymbol(symbol)) {
    return "";
  }
  const startAtValidation = ValidDateSchema.safeParse(startAt);
  if (startAtValidation.error) {
    return "";
  }

  return `/api/pyth/get-pyth-feeds-demo-data/${datasource}/${removeReplaySymbolSuffix(symbol)}?startAt=${startAtValidation.data.toISOString()}`;
}

export async function fetchHistoricalData(
  url: string,
  maxRetries = 5,
  tryNum = 1,
): Promise<HistoricalDataResponseType> {
  try {
    const response = await fetch(url, { method: "GET" });

    const textResponse = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.statusText}: ${textResponse}`);
    }

    if (textResponse.length === 0) {
      throw new Error("Empty response");
    }

    const validated = HistoricalDataResponseSchema.safeParse(
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
  /** hooks */
  const checkIsMounted = useIsMounted();
  const { open: showAlert } = useAlert();

  /** context */
  const { addDataPoint, playbackSpeed } = usePythProAppStateContext();

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);
  const [startAtToFetch, setStartAtToFetch] = useState(INITIAL_START_AT);

  /** refs */
  const datasourcesRef = useRef(dataSources);
  const enabledRef = useRef(enabled);
  const playbackSpeedRef = useRef(playbackSpeed);
  const symbolRef = useRef(symbol);

  // last emitted timestamp across *all* data sources (global replay clock)
  const lastEmittedDatetimeRef = useRef<Nullish<Date>>(undefined);

  /** effects */
  useEffect(() => {
    datasourcesRef.current = dataSources;
    enabledRef.current =
      checkIsMounted() &&
      enabled &&
      isReplaySymbol(symbol) &&
      dataSources.every((ds) => isReplayDataSource(ds));
    playbackSpeedRef.current = playbackSpeed;
    symbolRef.current = symbol;
  });

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }

    setStatus("connected");

    const kickoffFetching = async () => {
      if (!enabledRef.current) return;

      let hasNext = true;
      let maxTimestamp = startAtToFetch;

      try {
        await Promise.all(
          dataSources.map(async (datasource) => {
            const url = getFetchHistoricalUrl(
              datasource,
              symbol,
              startAtToFetch,
            );

            const didSymbolChangeAsync = symbol !== symbolRef.current;
            const didDatasourceChangeAsync = dataSources.some(
              (ds) => !datasourcesRef.current.includes(ds),
            );

            // things changed on us async, so do nothing
            if (
              !enabledRef.current ||
              !url ||
              didSymbolChangeAsync ||
              didDatasourceChangeAsync
            ) {
              return;
            }

            const results = await fetchHistoricalData(url);

            hasNext &&= results.hasNext;
            maxTimestamp = new Date(
              Math.max(
                startAtToFetch.valueOf(),
                new Date(results.data?.at(-1)?.timestamp ?? "0").valueOf(),
              ),
            );

            for (let i = 1; i < results.data.length; i++) {
              // things changed async, do nothing
              if (!enabledRef.current) break;

              const prevDataPoint = results.data[i - 1];
              const currDataPoint = results.data[i];

              if (
                isNullOrUndefined(currDataPoint) &&
                !isNullOrUndefined(prevDataPoint)
              ) {
                // there's only a single datapoint, so just emit it and we're done
                addDataPoint(
                  prevDataPoint.source,
                  prevDataPoint.symbol,
                  prevDataPoint,
                );

                const prevTs = new Date(prevDataPoint.timestamp);
                lastEmittedDatetimeRef.current = lastEmittedDatetimeRef.current
                  ? // global "last emitted" should be the *max* we've seen
                    new Date(
                      Math.max(
                        lastEmittedDatetimeRef.current.valueOf(),
                        prevTs.valueOf(),
                      ),
                    )
                  : prevTs;

                continue;
              }

              // we shouldn't *technially* have to check if prevDataPoint is nullish,
              // because the guard immediately above here blocks that, but we'll do it
              // to appease the typing gods and just throw an error
              if (isNullOrUndefined(prevDataPoint)) {
                throw new Error(
                  `for some reason, the previousDataPoint for ${datasource}: ${symbol ?? "-unknown symbol-"} is nullish`,
                );
              }
              if (isNullOrUndefined(currDataPoint)) {
                throw new Error(
                  `for some reason, the currDataPoint for ${datasource}: ${symbol ?? "-unknown symbol-"} is nullish`,
                );
              }

              const prevTs = new Date(prevDataPoint.timestamp);
              const currTs = new Date(currDataPoint.timestamp);

              const delta = currTs.valueOf() - prevTs.valueOf();
              if (!isReplaySymbol(symbolRef.current)) continue;

              // compute how far this point is ahead of the last globally emitted point
              const globalLast = lastEmittedDatetimeRef.current;
              const globalDelta = globalLast
                ? currTs.valueOf() - globalLast.valueOf()
                : 0;

              // if this datasource is about to jump ahead of the global clock,
              // we need to wait so that all the streams are "buffered" and end up
              // synchronized in the UI, marching together
              if (globalDelta > 0) {
                await wait(globalDelta / playbackSpeedRef.current);
              }

              addDataPoint(
                currDataPoint.source,
                symbolRef.current,
                currDataPoint,
              );

              // advance the global last emitted timestamp
              lastEmittedDatetimeRef.current = globalLast
                ? new Date(Math.max(globalLast.valueOf(), currTs.valueOf()))
                : currTs;

              // then wait the intra-source delta to preserve within-stream pacing
              if (delta > 0) {
                await wait(delta / playbackSpeedRef.current);
              }
            }
          }),
        );
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        setError(error);
      }

      if (hasNext) {
        setStartAtToFetch(maxTimestamp);
      }
    };

    void kickoffFetching();
  }, [addDataPoint, dataSources, enabled, startAtToFetch, symbol]);

  useEffect(() => {
    if (error) {
      showAlert({ contents: error.message, title: "An error has occurred" });
    }
  }, [error, showAlert]);

  return { error, status };
}
