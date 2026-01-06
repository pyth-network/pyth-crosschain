import { useAlert } from "@pythnetwork/component-library/useAlert";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { wait } from "@pythnetwork/shared-lib/util";
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

const BASE_FETCH_HISTORICAL_DATA_RETRY_DELAY = 100; // 100 milliseconds

// 🚨 DEMO HACK ALERT: we pick some point into trading
// to ensure all APIs have saturated query results
const INITIAL_START_AT = new Date("2025-12-05T19:00:00.000Z");

// wait a maximum of 1 minute for data points to flush out.
// we should only be getting 1 minutes-worth of data, anyways,
// so this is even a fairly large waiting period
const MAX_WAIT_TO_PROCESS_TIME = 1000 * 60 * 2;

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
  /** hooks */
  const { open: showAlert } = useAlert();

  /** context */
  const { addDataPoint, playbackSpeed } = usePythProAppStateContext();

  /** refs */
  const playbackSpeedRef = useRef(playbackSpeed);
  const symbolRef = useRef(symbol);
  const startAtToFetchRef = useRef(INITIAL_START_AT);
  const canProcessRef = useRef(true);

  /** state */
  const [status, setStatus] =
    useState<UseDataStreamReturnType["status"]>("closed");
  const [error, setError] = useState<Nullish<Error>>(undefined);
  const [startAtToFetch, setStartAtToFetch] = useState(INITIAL_START_AT);

  /** callbacks */
  const handleFetchError = useCallback((error_: unknown) => {
    if (!(error_ instanceof Error)) throw error_;
    setError(error_);
  }, []);
  const processData = useCallback(
    async (data: GetPythHistoricalPricesReturnType) => {
      // if we don't have the greelight to process results,
      // we'll just spin for a while.
      // if we hit a max time, then we fully abort, doing nothing
      const waitStartTime = Date.now();
      while (!canProcessRef.current) {
        const now = Date.now();

        // if we've waited long enough and the prior
        // processor didn't free up the processing lock,
        // just abort and show an error to the user
        if (now - waitStartTime >= MAX_WAIT_TO_PROCESS_TIME) {
          showAlert({
            contents:
              "A timeout occurred while waiting to process the next historical data chunk. This is a bug 🐛 and should be reported.",
            title: "Historical playback error",
          });
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

          if (dataPointSymbol !== symbolRef.current) break;

          addDataPoint(currPoint.source, dataPointSymbol, currPoint);
        }

        if (i === quarterPoint) {
          if (lastPoint) {
            setStartAtToFetch(new Date(lastPoint.timestamp));
          } else {
            // there wasn't any data for this chunk, so just keep adding 1 minute
            // to the request until we get data back
            const d = new Date(startAtToFetchRef.current);
            d.setTime(d.getTime() + 1000 * 60);
            setStartAtToFetch(d);
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
    [addDataPoint, showAlert],
  );

  /** effects */
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    symbolRef.current = symbol;
    startAtToFetchRef.current = startAtToFetch;
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

    fetchHistoricalData(url).then(processData).catch(handleFetchError);
  }, [
    dataSources,
    enabled,
    handleFetchError,
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
