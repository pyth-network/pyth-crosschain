/* eslint-disable no-console */
import { DuckDBInstance } from "@duckdb/node-api";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { UNCOMPRESSED_DB_PATH } from "./constants";
import { inflateHistoricalDataDb } from "./inflate-db";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedEquitySymbolsType,
  HistoricalDataResponseType,
  PriceDataWithSource,
} from "../schemas/pyth/pyth-pro-demo-schema";
import { appendReplaySymbolSuffix } from "../schemas/pyth/pyth-pro-demo-schema";
import { isReplayDataSource, isReplaySymbol } from "../util/pyth-pro-demo";

await inflateHistoricalDataDb();

dayjs.extend(utc);
dayjs.extend(timezone);

type FetchHistoricalDataOpts = {
  datasources: AllDataSourcesType[];
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
  datasources,
  startAt,
  symbol,
}: FetchHistoricalDataOpts): Promise<HistoricalDataResponseType> {
  const normalizedStart = dayjs.tz(startAt, "UTC");
  const normalizedStartAt = normalizedStart.toISOString();
  const endAt = normalizedStart.add(1, "minute").toISOString();

  console.info(`querying DB for results with the following params:`);
  console.info(`  datasources: ${datasources.join(", ")}`);
  console.info(`  startAt: ${startAt}`);
  console.info(`  endAt: ${endAt}`);
  console.info(`  symbol: ${symbol}`);

  const instance = await DuckDBInstance.fromCache(UNCOMPRESSED_DB_PATH, {
    access_mode: "READ_ONLY",
    temp_directory: "/tmp",
    threads: "4",
  });
  const db = await instance.connect();

  const symbolWithSuffix = appendReplaySymbolSuffix(symbol);
  const out: PriceDataWithSource[] = [];
  const allDatasourcesValid = datasources.every((ds) => isReplayDataSource(ds));

  if (!isReplaySymbol(symbolWithSuffix) || !allDatasourcesValid) {
    return { data: out, hasNext: false };
  }

  const sourceContainedWithinExpression = `(${datasources.map(() => "?").join(",")})`;

  const results = await db.run(
    `SELECT hd.* FROM main.HistoricalData hd
WHERE hd.symbol = ?
	AND hd.datetime >= ?
  AND hd.datetime <= ?
  AND hd.source in ${sourceContainedWithinExpression}
order by hd.datetime asc`,
    [symbol, normalizedStartAt, endAt, ...datasources],
  );

  const remainingCountResults = await db.run(
    `SELECT COUNT(hd.*) as remainingCount
FROM main.HistoricalData hd
WHERE hd.symbol = ?
  AND hd.datetime > ?
  AND hd.source in ${sourceContainedWithinExpression}`,
    [symbol, endAt, ...datasources],
  );

  const [remainingCountResult] = await remainingCountResults.getRowObjectsJS();
  const { remainingCount } = remainingCountResult ?? {};

  for (const result of await results.getRowObjects()) {
    const typedResult = result as DatabaseResult;

    if (!isNumber(typedResult.price)) continue;
    const ask =
      typedResult.source === "pyth_pro"
        ? undefined
        : Number.parseFloat(String(typedResult.ask ?? ""));
    const bid =
      typedResult.source === "pyth_pro"
        ? undefined
        : Number.parseFloat(String(typedResult.bid ?? ""));

    out.push({
      ask,
      bid,
      price: typedResult.price,
      timestamp: new Date(typedResult.datetime).toISOString(),
      source: typedResult.source,
      symbol,
    });
  }

  return {
    data: out,
    hasNext: Number(remainingCount ?? 0) > 0,
  };
}
