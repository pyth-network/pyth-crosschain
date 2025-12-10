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
import { DatabaseSync } from "node:sqlite";
import { createGzip } from "node:zlib";

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

for (const symbol of symbols) {
  const data = correctedData.filter((d) => d.symbol === symbol);
  const fp = path.join(outdir, `${symbol}.csv`);
  await fs.ensureFile(fp);

  try {
    await fs.remove(fp);
  } catch {
    /* no-op */
  }

  await fs.writeFile(fp, unparse(data, { header: true }), "utf8");
}

const dbfilePath = path.join(outdir, "historical-demo-data.db");
const dbfilePathGzip = `${dbfilePath}.gz`;
await fs.ensureFile(dbfilePath);

const db = new DatabaseSync(dbfilePath, { open: true, readOnly: false });

db.exec(`CREATE TABLE IF NOT EXISTS HistoricalData (
  ask REAL,
  bid REAL,
  datetime NVARCHAR,
  price REAL,
  source VARCHAR,
  symbol VARCHAR,
  timestamp REAL
)`);

const insertStatement = db.prepare(`INSERT INTO HistoricalData
  (ask, bid, datetime, price, source, symbol, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

db.exec("BEGIN TRANSACTION");

for (const {
  ask,
  bid,
  datetime,
  price,
  source,
  symbol,
  timestamp,
} of correctedData) {
  insertStatement.run(ask, bid, datetime, price, source, symbol, timestamp);
}

db.exec("COMMIT");
db.close();

// clear out things we don't need in memory anymore so we don't overload the process
correctedData.length = 0;

const dbfileReadStream = fs.createReadStream(dbfilePath);
const dbcompressWriteStream = fs.createWriteStream(dbfilePathGzip);
const gzipWriteStream = createGzip({ level: 9 }); // maximum compression for the smallest filesize

dbfileReadStream.pipe(gzipWriteStream).pipe(dbcompressWriteStream);

await new Promise<void>((resolve, reject) => {
  dbcompressWriteStream.once("finish", resolve);
  dbcompressWriteStream.once("error", reject);
});
