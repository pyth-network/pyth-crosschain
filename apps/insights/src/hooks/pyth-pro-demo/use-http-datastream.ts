import { useAlert } from "@pythnetwork/component-library/useAlert";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { wait } from "@pythnetwork/shared-lib/util";
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
  appendReplaySymbolSuffix,
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
  const { open: showAlert } = useAlert();

  /** context */
  const { addDataPoint, playbackSpeed } = usePythProAppStateContext();

  /** refs */
  const playbackSpeedRef = useRef(playbackSpeed);
  const symbolRef = useRef(symbol);

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);
  const [startAtToFetch, setStartAtToFetch] = useState(INITIAL_START_AT);

  /** effects */
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    symbolRef.current = symbol;
  });

  useEffect(() => {
    if (!enabled || !isReplaySymbol(symbol)) {
      setStatus("closed");
      return;
    }

    const url = getFetchHistoricalUrl(dataSources, symbol, startAtToFetch);
    if (!url) {
      setStatus("closed");
      return;
    }

    setStatus("connected");

    fetchHistoricalData(url)
      .then(async ({ data, hasNext }) => {
        // all the results should be in order of timestamp, regardless of the datasource
        // so we'll just write them all out to the chart as they flow in.
        // this may mean that one data source runs further ahead than another for a bit,
        // if there is no data for a certain time interval

        for (let i = 0; i < data.length; i++) {
          const currPoint = data[i];
          const nextPoint = data[i + 1];

          if (currPoint) {
            const dataPointSymbol = appendReplaySymbolSuffix(currPoint.symbol);

            if (dataPointSymbol !== symbolRef.current) break;

            addDataPoint(currPoint.source, dataPointSymbol, currPoint);
          }

          if (currPoint && nextPoint) {
            const delta =
              new Date(nextPoint.timestamp).valueOf() -
              new Date(currPoint.timestamp).valueOf();
            await wait(delta / playbackSpeedRef.current);
          }
        }

        const lastPoint = data.at(-1);

        if (lastPoint && hasNext) {
          setStartAtToFetch(new Date(lastPoint.timestamp));
        }
      })
      .catch((error_: unknown) => {
        if (!(error_ instanceof Error)) throw error_;
        setError(error_);
      });
  }, [addDataPoint, dataSources, enabled, startAtToFetch, symbol]);

  useEffect(() => {
    if (!error) return;

    showAlert({
      contents: error.message,
      title: "Historical data failed to fetch",
    });
  }, [error, showAlert]);

  return { error, status };
}
