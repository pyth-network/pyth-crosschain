/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { wait } from "@pythnetwork/shared-lib/util";
import { useEffect, useRef, useState } from "react";

import type { UseDataStreamReturnType, UseHttpDataStreamOpts } from "./types";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type {
  AllAllowedSymbols,
  PriceDataWithSource,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { removeReplaySymbolSuffix } from "../../schemas/pyth/pyth-pro-demo-schema";
import { isAllowedDataSource, isReplaySymbol } from "../../util/pyth-pro-demo";

function getFetchHistoricalUrl(symbol: Nullish<AllAllowedSymbols>) {
  if (!isReplaySymbol(symbol)) {
    return "";
  }
  return `/api/pyth/get-pyth-feeds-demo-data/${removeReplaySymbolSuffix(symbol)}`;
}

async function fetchHistoricalData({
  baseUrl,
  limit,
  signal,
  startAt,
}: {
  baseUrl: string;
  signal: AbortSignal;
  startAt: number;
  limit: number;
}) {
  const response = await fetch(
    `${baseUrl}?startAt=${startAt.toString()}&limit=${limit.toString()}`,
    { method: "GET", signal },
  );
  if (!response.ok) {
    const errRes = (await response.json()) as { error: string };
    throw new Error(errRes.error);
  }
  const parsed = (await response.json()) as PriceDataWithSource[];

  return parsed;
}

export function useHttpDataStream({
  dataSources,
  enabled,
  symbol,
}: UseHttpDataStreamOpts): UseDataStreamReturnType & { error: Nullish<Error> } {
  /** context */
  const { addDataPoint } = usePythProAppStateContext();

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);

  /** refs */
  const dataSourcesSetRef = useRef(new Set(dataSources));
  const enabledRef = useRef(enabled);
  const abortControllerRef = useRef<Nullish<AbortController>>(undefined);

  /** effects */
  useEffect(() => {
    enabledRef.current = enabled;
    dataSourcesSetRef.current = new Set(dataSources);
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
      const allDataSourcesAllowed = dataSources.every((ds) =>
        isAllowedDataSource(ds),
      );
      if (!isReplaySymbol(symbol) || !allDataSourcesAllowed) {
        abortControllerRef.current?.abort();
        return;
      }
      let startAt = 1_764_772_200_000;
      const limit = 1000;

      let results: PriceDataWithSource[];
      let nextResults: Nullish<PriceDataWithSource[]>;

      try {
        do {
          // Check if component is still mounted
          if (!isMounted || !enabledRef.current) {
            abortControllerRef.current?.abort();
            return;
          }

          const abt = new AbortController();
          abortControllerRef.current = abt;

          const baseUrl = getFetchHistoricalUrl(symbol);

          results =
            nextResults ??
            (await fetchHistoricalData({
              baseUrl,
              limit,
              signal: abt.signal,
              startAt,
            }));

          const resultsLen = results.length;
          const midpoint = Math.floor(resultsLen / 2);
          startAt = results.at(-1)?.timestamp ?? startAt + 1000;

          for (let i = 0; i < resultsLen; i++) {
            // Check again inside the loop
            if (!isMounted) {
              abortControllerRef.current.abort();
              return;
            }

            const dataPoint = results[i];
            const nextDataPoint = results[i + 1];

            if (
              !dataPoint ||
              !dataSourcesSetRef.current.has(dataPoint.source) ||
              !nextDataPoint
            ) {
              continue;
            }

            if (i === 0) {
              addDataPoint(dataPoint.source, symbol, dataPoint);
            }

            const syntheticTimeToWait =
              nextDataPoint.timestamp - dataPoint.timestamp;

            await wait(syntheticTimeToWait);

            if (!isMounted) {
              abortControllerRef.current.abort();
              return;
            }

            addDataPoint(dataPoint.source, symbol, nextDataPoint);

            if (i === midpoint) {
              const abt = new AbortController();
              abortControllerRef.current = abt;
              void fetchHistoricalData({
                baseUrl,
                limit,
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
        } while (results.length > 0);
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
  }, [addDataPoint, dataSources, enabled, symbol]);

  return { error, status };
}
