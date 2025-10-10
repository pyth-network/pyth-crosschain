import type { NextRequest } from "next/server";
import { z } from "zod";

import { getHistoricalPrices } from "../../services/clickhouse";

const queryParamsSchema = z.object({
  symbol: z.string().transform(decodeURIComponent),
  publisher: z
    .string()
    .nullable()
    .transform((value) => value ?? undefined),
  from: z.string().transform(Number),
  to: z.string().transform(Number),
  resolution: z.enum(["1s", "1m", "5m", "1H", "1D"]).transform((value) => {
    switch (value) {
      case "1s": {
        return "1 SECOND";
      }
      case "1m": {
        return "1 MINUTE";
      }
      case "5m": {
        return "5 MINUTE";
      }
      case "1H": {
        return "1 HOUR";
      }
      case "1D": {
        return "1 DAY";
      }
    }
  }),
});

export async function GET(req: NextRequest) {
  const parsed = queryParamsSchema.safeParse(
    Object.fromEntries(
      Object.keys(queryParamsSchema.shape).map((key) => [
        key,
        req.nextUrl.searchParams.get(key),
      ]),
    ),
  );
  if (!parsed.success) {
    return new Response(`Invalid params: ${parsed.error.message}`, {
      status: 400,
    });
  }

  const { symbol, publisher, from, to, resolution } = parsed.data;

  if (getNumDataPoints(to, from, resolution) > MAX_DATA_POINTS) {
    return new Response("Unsupported resolution for date range", {
      status: 400,
    });
  }

  const res = await getHistoricalPrices({
    symbol,
    from,
    to,
    publisher,
    resolution,
  });

  return Response.json(res);
}

const MAX_DATA_POINTS = 3000;

type Resolution = "1 SECOND" | "1 MINUTE" | "5 MINUTE" | "1 HOUR" | "1 DAY";
const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;

const SECONDS_IN_ONE_PERIOD: Record<Resolution, number> = {
  "1 SECOND": 1,
  "1 MINUTE": ONE_MINUTE_IN_SECONDS,
  "5 MINUTE": 5 * ONE_MINUTE_IN_SECONDS,
  "1 HOUR": ONE_HOUR_IN_SECONDS,
  "1 DAY": 24 * ONE_HOUR_IN_SECONDS,
};

const getNumDataPoints = (from: number, to: number, resolution: Resolution) =>
  (to - from) / SECONDS_IN_ONE_PERIOD[resolution];
