import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { NextRequest, NextResponse } from "next/server";

import { fetchHistoricalDataForPythFeedsDemo } from "../../../../../../pyth-feed-demo-data/fetch-historical-data-from-db";
import {
  ALLOWED_EQUITY_SYMBOLS,
  DATA_SOURCES_REPLAY,
} from "../../../../../../schemas/pyth/pyth-pro-demo-schema";

export const GET = async (
  req: NextRequest,
  ctx: { params: Promise<{ datasource: string; symbol: string }> },
) => {
  const { datasource, symbol } = await ctx.params;
  const datasourceValidation =
    await DATA_SOURCES_REPLAY.safeParseAsync(datasource);

  if (datasourceValidation.error) {
    return NextResponse.json(
      { error: datasourceValidation.error.message },
      { status: 400 },
    );
  }

  const symbolValidation = await ALLOWED_EQUITY_SYMBOLS.safeParseAsync(symbol);
  if (symbolValidation.error) {
    return NextResponse.json(
      { error: symbolValidation.error.message },
      { status: 400 },
    );
  }

  const {
    nextUrl: { searchParams },
  } = req;

  const startAtParam = searchParams.get("startAt");
  if (isNullOrUndefined(startAtParam)) {
    return NextResponse.json(
      { error: "startAt query parameter is required" },
      { status: 400 },
    );
  }
  const startAt = new Date(startAtParam);
  if (startAt.toString() === "Invalid Date") {
    return NextResponse.json(
      { error: "startAt query parameter is not a valid ISO date string" },
      { status: 400 },
    );
  }

  const symbolToUse = symbolValidation.data;
  const datasourceToUse = datasourceValidation.data;

  const { data, hasNext } = await fetchHistoricalDataForPythFeedsDemo({
    datasource: datasourceToUse,
    startAt: startAt.toISOString(),
    symbol: symbolToUse,
  });

  return NextResponse.json({
    data: data.sort((a, b) => a.timestamp - b.timestamp),
    hasNext,
  });
};
