import { NextRequest, NextResponse } from "next/server";

import {
  ALLOWED_EQUITY_SYMBOLS,
  DATA_SOURCES_REPLAY,
} from "../../../../../schemas/pyth/pyth-pro-demo-schema";
import { fetchHistoricalDataForPythFeedsDemo } from "../../../../../static-data/pyth-pro-demo";

const DEFAULT_START_AT = 0;

export const GET = async (
  req: NextRequest,
  ctx: { params: Promise<{ symbol: string }> },
) => {
  const { symbol } = await ctx.params;

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

  const startAt = Number(searchParams.get("startAt") ?? DEFAULT_START_AT);

  const symbolToUse = symbolValidation.data;

  const data = fetchHistoricalDataForPythFeedsDemo({
    datasources: DATA_SOURCES_REPLAY.options,
    startAt,
    symbol: symbolToUse,
  });

  return NextResponse.json(data.sort((a, b) => a.timestamp - b.timestamp));
};
