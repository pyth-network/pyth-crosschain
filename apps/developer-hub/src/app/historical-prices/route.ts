import type { NextRequest } from "next/server";

import { getHistoricalPrices } from "../../services/clickhouse";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const until = req.nextUrl.searchParams.get("until");
  if (symbol && until) {
    const res = await getHistoricalPrices(decodeURIComponent(symbol), until);
    return Response.json(res);
  } else {
    return new Response("Must provide `symbol` and `until`", { status: 400 });
  }
}
