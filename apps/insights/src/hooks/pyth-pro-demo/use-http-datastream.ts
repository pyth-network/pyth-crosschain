/* eslint-disable @typescript-eslint/no-unnecessary-condition */
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
): Promise<HistoricalDataResponseType> {
  const response = await fetch(url, {
    method: "GET",
  });
  if (!response.ok) {
    const errRes = (await response.json()) as { error: string };
    throw new Error(errRes.error);
  }

  // we need to read as text first, because
  // next.js is sometimes returning an empty response for no apparent
  // reason and we need to immediately retry the fetch operation
  const textResponse = await response.text();
  if (textResponse.length <= 0) {
    return fetchHistoricalData(url);
  }
  const parsed = JSON.parse(textResponse) as object;
  const validated = HistoricalDataResponseSchema.safeParse(parsed);
  if (validated.error) {
    throw new Error(validated.error.message);
  }

  return validated.data;
}

export function useHttpDataStream({
  dataSources,
  enabled,
  symbol,
}: UseHttpDataStreamOpts): UseHttpDataStreamReturnType {
  /** hooks */
  const checkIsMounted = useIsMounted();

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

              const delta =
                new Date(currDataPoint.timestamp).valueOf() -
                new Date(prevDataPoint.timestamp).valueOf();

              if (!isReplaySymbol(symbolRef.current)) continue;

              addDataPoint(
                currDataPoint.source,
                symbolRef.current,
                currDataPoint,
              );
              await wait(delta / playbackSpeedRef.current);
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

  return { error, status };
}
