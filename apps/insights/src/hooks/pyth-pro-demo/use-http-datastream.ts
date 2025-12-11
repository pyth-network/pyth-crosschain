/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { wait } from "@pythnetwork/shared-lib/util";
import { useEffect, useRef, useState } from "react";

import type { UseDataStreamOpts, UseDataStreamReturnType } from "./types";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  HistoricalDataResponseType,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  HistoricalDataResponseSchema,
  removeReplaySymbolSuffix,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  isAllowedDataSource,
  isReplayDataSource,
  isReplaySymbol,
} from "../../util/pyth-pro-demo";

// 🚨 DEMO HACK ALERT: we pick some point into trading
// to ensure all APIs have saturated query results
const INITIAL_START_AT = new Date("2025-12-05T09:00:00.000Z");

function getFetchHistoricalUrl(
  datasource: Nullish<AllDataSourcesType>,
  symbol: Nullish<AllAllowedSymbols>,
) {
  if (!isReplayDataSource(datasource) || !isReplaySymbol(symbol)) {
    return "";
  }
  return `/api/pyth/get-pyth-feeds-demo-data/${datasource}/${removeReplaySymbolSuffix(symbol)}`;
}

export async function fetchHistoricalData(opts: {
  baseUrl: string;
  signal: AbortSignal;
  startAt: Date;
}): Promise<HistoricalDataResponseType> {
  const { baseUrl, signal, startAt } = opts;
  const response = await fetch(`${baseUrl}?startAt=${startAt.toISOString()}`, {
    method: "GET",
    signal,
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
    return fetchHistoricalData(opts);
  }
  const parsed = JSON.parse(textResponse) as object;
  const validated = HistoricalDataResponseSchema.safeParse(parsed);
  if (validated.error) {
    throw new Error(validated.error.message);
  }

  return validated.data;
}

export function useHttpDataStream({
  dataSource,
  enabled,
  symbol,
}: UseDataStreamOpts): UseDataStreamReturnType & { error: Nullish<Error> } {
  /** context */
  const { addDataPoint, playbackSpeed } = usePythProAppStateContext();

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);

  /** refs */
  const datasourceRef = useRef(dataSource);
  const enabledRef = useRef(enabled);
  const generationRef = useRef(0);
  const playbackSpeedRef = useRef(playbackSpeed);

  /** effects */
  useEffect(() => {
    datasourceRef.current = dataSource;
    enabledRef.current = enabled;
    playbackSpeedRef.current = playbackSpeed;
  });

  useEffect(() => {
    const { current: generation } = generationRef;
    if (!enabled) {
      setStatus("closed");
      return;
    }

    setStatus("connected");

    // Add a flag to track if the effect is still mounted
    let isMounted = true;

    const kickoffFetching = async () => {
      const allDataSourcesAllowed = isAllowedDataSource(datasourceRef.current);
      if (!isReplaySymbol(symbol) || !allDataSourcesAllowed) return;

      let startAt = INITIAL_START_AT;
      let results: HistoricalDataResponseType;
      let nextResults: Nullish<HistoricalDataResponseType>;

      try {
        do {
          // Check if component is still mounted
          if (
            !isMounted ||
            !enabledRef.current ||
            generation !== generationRef.current
          )
            return;

          const abt = new AbortController();

          const baseUrl = getFetchHistoricalUrl(datasourceRef.current, symbol);

          results =
            nextResults ??
            (await fetchHistoricalData({
              baseUrl,
              signal: abt.signal,
              startAt,
            }));

          const { data } = results;

          const resultsLen = data.length;
          const midpoint = Math.floor(resultsLen / 2);
          const lastTimestamp = data.at(-1)?.timestamp;
          startAt = lastTimestamp
            ? new Date(lastTimestamp)
            : new Date(startAt.valueOf() + 1000);

          for (let i = 0; i < resultsLen; i++) {
            // Check again inside the loop
            if (!isMounted) {
              return;
            }

            const dataPoint = data[i];
            const nextDataPoint = data[i + 1];

            if (
              !dataPoint ||
              datasourceRef.current !== dataPoint.source ||
              !nextDataPoint
            ) {
              continue;
            }

            const {
              ask: currentPointAsk,
              bid: currentPointBid,
              price: currentPointPrice,
              source: currentPointSource,
              timestamp: currentPointTimestamp,
            } = dataPoint;
            const {
              ask: nextPointAsk,
              bid: nextPointBid,
              price: nextPointPrice,
              source: nextPointSource,
              timestamp: nextPointTimestamp,
            } = nextDataPoint;

            if (i === 0) {
              addDataPoint(currentPointSource, symbol, {
                ask: currentPointAsk,
                bid: currentPointBid,
                price: currentPointPrice,
                timestamp: currentPointTimestamp,
              });
            }

            const syntheticTimeToWait =
              new Date(nextPointTimestamp).valueOf() -
              new Date(currentPointTimestamp).valueOf();

            await wait(syntheticTimeToWait / playbackSpeedRef.current);

            if (!isMounted) {
              return;
            }

            addDataPoint(nextPointSource, symbol, {
              ask: nextPointAsk,
              bid: nextPointBid,
              price: nextPointPrice,
              timestamp: nextPointTimestamp,
            });

            if (i === midpoint) {
              const abt = new AbortController();
              void fetchHistoricalData({
                baseUrl,
                startAt,
                signal: abt.signal,
              })
                .then((r) => {
                  if (isMounted) {
                    nextResults = r;
                  }
                })
                .catch((error_: unknown) => {
                  if (isMounted) {
                    if (!(error_ instanceof Error)) throw error_;
                    setError(error_);
                  }
                });
            }
          }
        } while (results.hasNext);
      } catch (error) {
        if (isMounted) {
          if (!(error instanceof Error)) throw error;
          setError(error);
        }
      }
    };

    void kickoffFetching();

    return () => {
      isMounted = false;
    };
  }, [addDataPoint, dataSource, enabled, symbol]);

  return { error, status };
}
