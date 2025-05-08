import type { NextRequest } from "next/server";

import { getYesterdaysPrices } from "../../services/clickhouse";

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.getAll("symbols");
  const data = await getYesterdaysPrices(symbols);
  return Response.json(
    Object.fromEntries(data.map(({ symbol, price }) => [symbol, price])),
  );
}
