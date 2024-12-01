import type { NextRequest } from "next/server";
import { z } from "zod";

import { client } from "../../clickhouse";

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.getAll("symbols");
  const rows = await client.query({
    query:
      "select * from insights_yesterdays_prices(symbols={symbols: Array(String)})",
    query_params: { symbols },
  });
  const result = await rows.json();
  const data = schema.parse(result.data);
  return Response.json(
    Object.fromEntries(data.map(({ symbol, price }) => [symbol, price])),
  );
}

const schema = z.array(
  z.object({
    symbol: z.string(),
    price: z.number(),
  }),
);
