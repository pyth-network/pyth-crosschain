/* eslint-disable */
// due to the size of the json data being imported,
// we have to disable eslint or it will crash nonstop

import glob from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

import {
  type AllowedEquitySymbolsType,
  type DataSourcesHistoricalType,
  type PriceData,
  PriceDataSchema,
} from "../../schemas/pyth/pyth-pro-demo-schema";

// according to the next.js docs, file reading occurs from the nearest
// package.json file, which is the "root" of the deployment:
// https://vercel.com/kb/guide/loading-static-file-nextjs-api-route
const globPattern = path
  .join(process.cwd(), "src", "static-data", "pyth-pro-demo", "*.json")
  .replaceAll("\\", "/");
const jsonSampleDataPaths = glob.sync(
  // allows globs to work on Windows
  globPattern,
  { absolute: true, onlyFiles: true },
);

type PythDataEntry = {
  best_ask_price: string;
  best_bid_price: string;
  channel: string;
  confidence: string;
  exponent: string;
  funding_rate: string;
  funding_rate_interval_us: string;
  funding_timestamp: string;
  market_session: string;
  price: string;
  price_feed_id: string;
  publish_time: Date;
  publisher_count: string;
  state: string;
};

type NasdaqDataEntry = {
  "#RIC": string;
  "Ask Price": string;
  "Ask Size": string;
  "Bid Price": string;
  "Bid Size": string;
  "Date-Time": Date;
  Price: string;
  Volume: string;
};

type FetchHistoricalDataOpts = {
  datasource: DataSourcesHistoricalType;
  limit: number;
  startAt: number;
  symbol: AllowedEquitySymbolsType;
};

/**
 * scrapes historical data out of the extracted data provided
 * for the upcoming demo
 */
export async function fetchHistoricalDataForPythFeedsDemo({
  datasource,
  limit,
  startAt,
  symbol,
}: FetchHistoricalDataOpts): Promise<PriceData[]> {
  let out: PriceData[] = [];

  if (symbol !== "HOOD") {
    return out;
  }

  const files = jsonSampleDataPaths.filter((p) => {
    const basename = path.basename(p);
    return datasource === "NASDAQ"
      ? basename.startsWith("nasdaq")
      : basename.startsWith("pyth");
  });
  if (datasource === "NASDAQ") {
    out = (
      await Promise.all(
        files.map(async (fp) => {
          const { data } = JSON.parse(await fs.readFile(fp, "utf8")) as {
            data: NasdaqDataEntry[];
          };

          return data.map<PriceData>((d) => {
            const validation = PriceDataSchema.safeParse({
              price: Number.parseFloat(d.Price),
              timestamp: new Date(d["Date-Time"]).getTime(),
            });
            if (validation.error) {
              throw new Error(validation.error.message);
            }
            return validation.data;
          });
        }),
      )
    ).flat();
  } else {
    out = (
      await Promise.all(
        files.map(async (fp) => {
          const data = JSON.parse(
            await fs.readFile(fp, "utf8"),
          ) as PythDataEntry[];
          return data.map<PriceData>((d) => {
            const validation = PriceDataSchema.safeParse({
              price: Number.parseFloat(d.price),
              timestamp: new Date(d.publish_time).getTime(),
            });
            if (validation.error) {
              throw new Error(validation.error.message);
            }
            return validation.data;
          });
        }),
      )
    ).flat();
  }

  console.info("out.length", out.length);
  return out.filter((entry) => entry.timestamp >= startAt).slice(0, limit);
}
