import type { Nullish } from "@pythnetwork/shared-lib/types";
import { useEffect, useRef, useState } from "react";

import type { UseDataStreamOpts, UseDataStreamReturnType } from "./types";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  PriceData,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  isAllowedDataSource,
  isHistoricalSymbol,
} from "../../util/pyth-pro-demo";

function getFetchHistoricalUrl(
  dataSource: Nullish<AllDataSourcesType>,
  symbol: Nullish<AllAllowedSymbols>,
) {
  if (!isAllowedDataSource(dataSource) || !isHistoricalSymbol(symbol)) {
    return "";
  }
  return `/api/pyth/get-pyth-feeds-demo-data/${dataSource}/${symbol.replace(":::historical", "")}`;
}

export function useHttpDataStream({
  dataSource,
  enabled,
  symbol,
}: UseDataStreamOpts): UseDataStreamReturnType & { error: Nullish<Error> } {
  /** context */
  const { addHistoricalDataPoints } = usePythProAppStateContext();

  /** local variables */
  const baseUrl = getFetchHistoricalUrl(dataSource, symbol);

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);

  /** refs */
  const enabledRef = useRef(enabled);
  const abortControllerRef = useRef<Nullish<AbortController>>(undefined);

  /** effects */
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!baseUrl || !enabled) {
      setStatus("closed");
      return;
    }

    setStatus("connected");

    const abt = new AbortController();

    const fetchHistoricalData = async (startAt: number, limit: number) => {
      const response = await fetch(
        `${baseUrl}?startAt=${startAt.toString()}&limit=${limit.toString()}`,
      );
      if (!response.ok) {
        const errRes = (await response.json()) as { error: string };
        throw new Error(errRes.error);
      }
      const parsed = (await response.json()) as PriceData[];

      return parsed;
    };

    const startFetching = async () => {
      abortControllerRef.current?.abort();

      abortControllerRef.current = abt;

      let data: PriceData[];

      // This may seem arbitrary but it's the first
      // timestamp we have NASDAQ data for the demo,
      // so we'll just start here so we don't have pyth data bloating the UI
      let startAt = 1_764_720_009_299;
      const limit = 1000;

      do {
        if (!enabledRef.current || !isHistoricalSymbol(symbol)) break;

        try {
          data = await fetchHistoricalData(startAt, limit);
          const [last] = data.slice(-1);

          startAt = last?.timestamp ?? startAt + 1000; // just add one second to this if there wasn't an entry

          addHistoricalDataPoints(dataSource, symbol, data);
        } catch (error) {
          if (!(error instanceof Error)) {
            throw error;
          }
          setError(error);
          break;
        }
      } while (data.length > 0);
    };

    void startFetching();

    return () => {
      abt.abort();
    };
  }, [addHistoricalDataPoints, baseUrl, dataSource, enabled, symbol]);

  return { error, status };
}
