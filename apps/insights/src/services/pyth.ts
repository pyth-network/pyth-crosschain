import {
  PythHttpClient,
  PythConnection,
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
} from "@pythnetwork/client";
import type { PythPriceCallback } from "@pythnetwork/client/lib/PythConnection";
import { Connection, PublicKey } from "@solana/web3.js";
import { z } from "zod";

import { cache } from "../cache";

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;
const CLUSTER = "pythnet";

const connection = new Connection(getPythClusterApiUrl(CLUSTER));
const programKey = getPythProgramKeyForCluster(CLUSTER);
export const client = new PythHttpClient(connection, programKey);

export const getData = cache(
  async () => {
    const data = await client.getData();
    return priceFeedsSchema.parse(
      data.symbols.map((symbol) => ({
        symbol,
        product: data.productFromSymbol.get(symbol),
        price: data.productPrice.get(symbol),
      })),
    );
  },
  ["pyth-data"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

const priceFeedsSchema = z.array(
  z.object({
    symbol: z.string(),
    product: z.object({
      display_symbol: z.string(),
      asset_type: z.string(),
      description: z.string(),
      price_account: z.string(),
      base: z.string().optional(),
      country: z.string().optional(),
      quote_currency: z.string().optional(),
      tenor: z.string().optional(),
      cms_symbol: z.string().optional(),
      cqs_symbol: z.string().optional(),
      nasdaq_symbol: z.string().optional(),
      generic_symbol: z.string().optional(),
      weekly_schedule: z.string().optional(),
      schedule: z.string().optional(),
      contract_id: z.string().optional(),
    }),
    price: z.object({
      exponent: z.number(),
      numComponentPrices: z.number(),
      numQuoters: z.number(),
      minPublishers: z.number(),
      lastSlot: z.bigint(),
      validSlot: z.bigint(),
    }),
  }),
);

export const getTotalFeedCount = async () => {
  const pythData = await getData();
  return pythData.filter(({ price }) => price.numComponentPrices > 0).length;
};

export const subscribe = (feeds: PublicKey[], cb: PythPriceCallback) => {
  const pythConn = new PythConnection(
    connection,
    programKey,
    "confirmed",
    feeds,
  );
  pythConn.onPriceChange(cb);
  return pythConn;
};
