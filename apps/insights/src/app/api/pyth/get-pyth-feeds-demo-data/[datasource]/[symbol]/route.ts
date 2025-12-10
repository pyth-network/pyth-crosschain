import { NextRequest, NextResponse } from "next/server";

import {
  ALLOWED_EQUITY_SYMBOLS,
  DATA_SOURCES_REPLAY,
} from "../../../../../../schemas/pyth/pyth-pro-demo-schema";
import { fetchHistoricalDataForPythFeedsDemo } from "../../../../../../static-data/pyth-pro-demo";

const DEFAULT_START_AT = 0;

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

  const startAt = Number(searchParams.get("startAt") ?? DEFAULT_START_AT);

  const symbolToUse = symbolValidation.data;
  const datasourceToUse = datasourceValidation.data;

  const { data, hasNext } = fetchHistoricalDataForPythFeedsDemo({
    datasource: datasourceToUse,
    startAt,
    symbol: symbolToUse,
  });

  return NextResponse.json({
    data: data.sort((a, b) => a.timestamp - b.timestamp),
    hasNext,
  });
};
