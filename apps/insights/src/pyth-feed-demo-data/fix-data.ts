/* eslint-disable no-console */
/* eslint-disable unicorn/no-null */

/**
 * To use this script, simply place any CSVs
 * that you want massaged and normalized
 * into the ./input folder relative to this file.
 * the resulting, massaged CSV will be written to the
 * ./output folder
 */

import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";
import fs from "fs-extra";
import { glob } from "glob";
import papa from "papaparse";

import type { NasdaqEntry, OutputEntry, PythEntry } from "./types";
import { ALLOWED_EQUITY_SYMBOLS } from "../schemas/pyth/pyth-pro-demo-schema";

const { parse, unparse } = papa;

const outdir = path.join(import.meta.dirname, "output");

function coerceNum(num: unknown, defaultVal = Number.MIN_SAFE_INTEGER) {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const parsed = Number.parseFloat(String(num ?? ""));
  return Number.isNaN(parsed) ? defaultVal : parsed;
}

await fs.remove(outdir);

const csvs = await glob(
  path.join(import.meta.dirname, "input", "**", "*.csv"),
  {
    absolute: true,
    nodir: true,
  },
);

if (csvs.length === 0) {
  throw new Error("no files were found in the ./input folder to process");
}

const correctedData: OutputEntry[] = [];

const symbols = new Set<string>();

for (const fp of csvs) {
  const contents = await fs.readFile(fp, "utf8");

  const parsed = parse(contents, { header: true });

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];

    // change this, as needed
    const typedRow = row as PythEntry | NasdaqEntry;

    let ask: OutputEntry["ask"] = Number.MIN_SAFE_INTEGER;
    let bid: OutputEntry["bid"] = Number.MIN_SAFE_INTEGER;
    let exponent: number;
    let price: OutputEntry["price"];
    let timestamp: OutputEntry["timestamp"] | null = null;
    let source: OutputEntry["source"];
    let symbol: OutputEntry["symbol"];

    if ("prevPublishTime" in typedRow) {
      // marginally-better format
      exponent = coerceNum(typedRow.expo, 0);
      source = "pyth_pro";
      price = coerceNum(typedRow.price);
      timestamp = typedRow.publishTime
        ? new Date(typedRow.publishTime).getTime()
        : null;
      const { symbol: rowSymbol } = typedRow;
      // we are assuming a format that looks like the following:
      // Equity.US.HOOD/USD.POST
      // where the last part of the first segment before the forward slash is the symbol
      symbol = rowSymbol?.split("/")[0]?.split(".").at(-1) ?? "";
    } else if ("GMT Offset" in typedRow) {
      // exchange format
      ask = coerceNum(typedRow.ask_price);
      bid = coerceNum(typedRow.bid_price);
      exponent = 0;
      price = coerceNum(typedRow.price);
      timestamp = typedRow.datetime
        ? new Date(typedRow.datetime).getTime()
        : null;
      source = "NASDAQ";
      symbol = typedRow.ticker ?? "";
    } else {
      console.warn(
        `an unsupported CSV row format was found in ${fp} on line ${String(i + 1)}. please be sure the CSVs conform to one of the types in ./types.ts`,
      );
      continue;
    }

    if (symbol && timestamp && price > 0) {
      const symbolValidation = ALLOWED_EQUITY_SYMBOLS.safeParse(symbol);
      if (symbolValidation.error) {
        throw new Error(symbolValidation.error.message);
      }

      symbols.add(symbolValidation.data);
      correctedData.push({
        ask: ask * 10 ** exponent,
        bid: bid * 10 ** exponent,
        datetime: new Date(timestamp).toISOString(),
        price: price * 10 ** exponent,
        source,
        symbol,
        timestamp,
      });
    }
  }
}

correctedData.sort((a, b) => a.timestamp - b.timestamp);

const outputCSV = path.join(outdir, "all-data.csv");
await fs.ensureFile(outputCSV);
await fs.writeFile(outputCSV, unparse(correctedData, { header: true }), "utf8");

const dbfilePath = path.join(outdir, "historical-demo-data.db");

const instance = await DuckDBInstance.create(dbfilePath, { threads: "4" });
const db = await instance.connect();

await db.run(`CREATE TABLE IF NOT EXISTS HistoricalData (
  ask REAL,
  bid REAL,
  datetime NVARCHAR,
  price REAL,
  source VARCHAR,
  symbol VARCHAR,
  timestamp REAL
)`);

await db.run("BEGIN TRANSACTION");

await db.run(`INSERT INTO HistoricalData
SELECT * FROM read_csv_auto('${outputCSV}', HEADER=TRUE)`);

await db.run("COMMIT");

db.closeSync();
