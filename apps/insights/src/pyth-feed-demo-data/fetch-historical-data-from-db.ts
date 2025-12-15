/* eslint-disable no-console */
import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedEquitySymbolsType,
  HistoricalDataResponseType,
  PriceDataWithSource,
} from "../schemas/pyth/pyth-pro-demo-schema";
import { appendReplaySymbolSuffix } from "../schemas/pyth/pyth-pro-demo-schema";
import { isReplayDataSource, isReplaySymbol } from "../util/pyth-pro-demo";

dayjs.extend(utc);
dayjs.extend(timezone);

const uncompressedDbPath = path.join(
  process.cwd(),
  "public",
  "db",
  "historical-demo-data.db",
);

type FetchHistoricalDataOpts = {
  datasource: AllDataSourcesType;
  startAt: string;
  symbol: AllowedEquitySymbolsType;
};

type DatabaseResult = {
  ask: Nullish<number>;
  bid: Nullish<number>;
  /**
   * in a valid ISO-8061 format that can be given to the new Date() constructor
   */
  datetime: string;
  price: Nullish<number>;
  source: AllDataSourcesType;
  symbol: AllAllowedSymbols;
};

/**
 * queries historical data out of the prepared SQLite database
 */
export async function fetchHistoricalDataForPythFeedsDemo({
  datasource,
  startAt,
  symbol,
}: FetchHistoricalDataOpts): Promise<HistoricalDataResponseType> {
  const normalizedStart = dayjs.tz(startAt, "UTC");
  const normalizedStartAt = normalizedStart.toISOString();
  const endAt = normalizedStart.add(1, "minute").toISOString();

  console.info(`querying DB for results with the following params:`);
  console.info(`  datasource: ${datasource}`);
  console.info(`  startAt: ${startAt}`);
  console.info(`  endAt: ${endAt}`);
  console.info(`  symbol: ${symbol}`);

  const instance = await DuckDBInstance.fromCache(uncompressedDbPath, {
    access_mode: "READ_ONLY",
    temp_directory: "/tmp",
    threads: "4",
  });
  const db = await instance.connect();

  const symbolWithSuffix = appendReplaySymbolSuffix(symbol);
  const out: PriceDataWithSource[] = [];
  const allDatasourcesValid = isReplayDataSource(datasource);

  if (!isReplaySymbol(symbolWithSuffix) || !allDatasourcesValid) {
    return { data: out, hasNext: false };
  }

  const queryForDataStatement =
    await db.prepare(`SELECT hd.* FROM main.HistoricalData hd 
WHERE hd.symbol = $symbol
	AND hd.datetime >= $startAt
  AND hd.datetime <= $endAt
  AND hd.source = $datasource
order by hd.datetime asc`);

  const lastTimestampStatement =
    await db.prepare(`SELECT COUNT(hd.datetime) as remainingCount FROM HistoricalData hd
WHERE hd.symbol = $symbol
	AND hd.datetime >= $lastDatetime
  AND hd.source = $source;`);

  queryForDataStatement.bind({
    datasource,
    endAt,
    startAt: normalizedStartAt,
    symbol,
  });

  const results = await queryForDataStatement.run();
  const resultsIterator = await results.getRowObjectsJS();

  for (const result of resultsIterator) {
    const typedResult = result as DatabaseResult;

    if (!isNumber(typedResult.price)) continue;
    const ask =
      typedResult.source === "pyth_pro"
        ? Number.NaN
        : Number.parseFloat(String(typedResult.ask ?? ""));
    const bid =
      typedResult.source === "pyth_pro"
        ? Number.NaN
        : Number.parseFloat(String(typedResult.bid ?? ""));

    out.push({
      ask: Number.isNaN(ask) ? undefined : ask,
      bid: Number.isNaN(bid) ? undefined : bid,
      price: typedResult.price,
      timestamp: new Date(typedResult.datetime).toISOString(),
      source: typedResult.source,
      symbol,
    });
  }

  const lastItem = out.at(-1);

  let hasNext = false;

  if (lastItem) {
    lastTimestampStatement.bind({
      lastDatetime: lastItem.timestamp,
      source: datasource,
      symbol,
    });

    const lastResults = await lastTimestampStatement.run();
    const [result] = await lastResults.getRowObjectsJS();

    hasNext = Number(result?.remainingCount ?? "0") > 0;
  }

  return {
    data: out,
    hasNext,
  };
}
