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
  ALLOWED_REPLAY_SYMBOLS,
  HistoricalDataResponseSchema,
  removeReplaySymbolSuffix,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  isAllowedDataSource,
  isReplayDataSource,
  isReplaySymbol,
} from "../../util/pyth-pro-demo";

function getFetchHistoricalUrl(
  datasource: Nullish<AllDataSourcesType>,
  symbol: Nullish<AllAllowedSymbols>,
) {
  if (!isReplayDataSource(datasource) || !isReplaySymbol(symbol)) {
    return "";
  }
  return `/api/pyth/get-pyth-feeds-demo-data/${datasource}/${removeReplaySymbolSuffix(symbol)}`;
}

async function fetchHistoricalData({
  baseUrl,
  signal,
  startAt,
}: {
  baseUrl: string;
  signal: AbortSignal;
  startAt: number;
}): Promise<HistoricalDataResponseType> {
  const response = await fetch(`${baseUrl}?startAt=${startAt.toString()}`, {
    method: "GET",
    signal,
  });
  if (!response.ok) {
    const errRes = (await response.json()) as { error: string };
    throw new Error(errRes.error);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed = await response.json();
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
  const { addDataPoint } = usePythProAppStateContext();

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);

  /** refs */
  const datasourceRef = useRef(dataSource);
  const enabledRef = useRef(enabled);
  const abortControllerRef = useRef<Nullish<AbortController>>(undefined);

  /** effects */
  useEffect(() => {
    datasourceRef.current = dataSource;
    enabledRef.current = enabled;
  });

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }

    const { current: currAbtController } = abortControllerRef;

    setStatus("connected");

    // Add a flag to track if the effect is still mounted
    let isMounted = true;

    const kickoffFetching = async () => {
      const allDataSourcesAllowed = isAllowedDataSource(datasourceRef.current);
      if (!isReplaySymbol(symbol) || !allDataSourcesAllowed) {
        abortControllerRef.current?.abort();
        return;
      }
      // 🚨 DEMO HACK ALERT: the earliest point where Pyth data and Nasdaq data overlaps
      // for the supported demo symbols
      let startAt =
        symbol === ALLOWED_REPLAY_SYMBOLS.Enum["TSLA:::replay"]
          ? 1_764_892_801_942
          : 1_764_892_801_942;

      let results: HistoricalDataResponseType;
      let nextResults: Nullish<HistoricalDataResponseType>;

      try {
        do {
          // Check if component is still mounted
          if (!isMounted || !enabledRef.current) {
            abortControllerRef.current?.abort();
            return;
          }

          const abt = new AbortController();
          abortControllerRef.current = abt;

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
          startAt = data.at(-1)?.timestamp ?? startAt + 1000;

          for (let i = 0; i < resultsLen; i++) {
            // Check again inside the loop
            if (!isMounted) {
              abortControllerRef.current.abort();
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
              nextPointTimestamp - currentPointTimestamp;

            await wait(syntheticTimeToWait);

            if (!isMounted) {
              abortControllerRef.current.abort();
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
              abortControllerRef.current = abt;
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
          abortControllerRef.current?.abort();
          if (!(error instanceof Error)) throw error;
          setError(error);
        }
      }
    };

    void kickoffFetching();

    return () => {
      isMounted = false;
      currAbtController?.abort();
    };
  }, [addDataPoint, dataSource, enabled, symbol]);

  return { error, status };
}
