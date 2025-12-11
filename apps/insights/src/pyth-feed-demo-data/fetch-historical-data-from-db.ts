/* eslint-disable no-console */
import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined, isNumber } from "@pythnetwork/shared-lib/util";
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
  const normalizedStartAt = dayjs.tz(startAt, "UTC").toISOString();

  console.info(`querying DB for results with the following params:`);
  console.info(`  datasource: ${datasource}`);
  console.info(`  startAt: ${startAt}`);
  console.info(`  symbol: ${symbol}`);

  const instance = await DuckDBInstance.fromCache(uncompressedDbPath, {
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
  AND hd.source = $datasource
order by hd.datetime asc
limit 1000;`);

  const lastTimestampStatement =
    await db.prepare(`SELECT MAX(d.datetime) as lastDateTime FROM HistoricalData d
  WHERE d.symbol = $symbol
    AND d.source = $source`);

  queryForDataStatement.bind({
    datasource,
    startAt: normalizedStartAt,
    symbol,
  });

  lastTimestampStatement.bind({
    source: datasource,
    symbol,
  });

  const results = await queryForDataStatement.run();
  const resultsIterator = await results.getRowObjectsJS();

  const lastTimestampResults = await lastTimestampStatement.run();
  const lastTimestampRows = await lastTimestampResults.getRowObjectsJS();
  const lastTimestamp = lastTimestampRows[0]?.lastDateTime ?? undefined;

  if (isNullOrUndefined(lastTimestamp)) return { data: [], hasNext: false };

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

  return {
    data: out,
    hasNext:
      out.length <= 0 ||
      (out.at(-1)?.timestamp ?? lastTimestamp) < lastTimestamp,
  };
}
