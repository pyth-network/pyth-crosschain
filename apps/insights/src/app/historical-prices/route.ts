import type { NextRequest } from "next/server";
import { z } from "zod";

import { getHistoricalPrices } from "../../services/clickhouse";

const queryParamsSchema = z.object({
  symbol: z.string().transform(decodeURIComponent),
  publisher: z
    .string()
    .nullable()
    .transform((value) => value ?? undefined),
  cluster: z.enum(["pythnet", "pythtest"]),
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

  const { symbol, publisher, cluster, from, to, resolution } = parsed.data;

  try {
    checkMaxDataPointsInvariant(from, to, resolution);
  } catch {
    return new Response("Unsupported resolution for date range", {
      status: 400,
    });
  }

  const res = await getHistoricalPrices({
    symbol,
    from,
    to,
    publisher,
    cluster,
    resolution,
  });

  return Response.json(res);
}

const MAX_DATA_POINTS = 3000;
function checkMaxDataPointsInvariant(
  from: number,
  to: number,
  resolution: "1 SECOND" | "1 MINUTE" | "5 MINUTE" | "1 HOUR" | "1 DAY",
) {
  let diff = to - from;
  switch (resolution) {
    case "1 MINUTE": {
      diff = diff / 60;
      break;
    }
    case "5 MINUTE": {
      diff = diff / 60 / 5;
      break;
    }
    case "1 HOUR": {
      diff = diff / 3600;
      break;
    }
    case "1 DAY": {
      diff = diff / 86_400;
      break;
    }
  }

  if (diff > MAX_DATA_POINTS) {
    throw new Error("Unsupported resolution for date range");
  }
}
