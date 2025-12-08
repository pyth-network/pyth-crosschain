import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_EQUITY_SYMBOLS,
  DATA_SOURCES_HISTORICAL,
} from "../../../../../../schemas/pyth/pyth-pro-demo-schema";
import { fetchHistoricalDataForPythFeedsDemo } from "../../../../../../static-data/pyth-pro-demo";

const DEFAULT_LIMIT = 1000;
const DEFAULT_START_AT = 0;

export const GET = async (
  req: NextRequest,
  ctx: RouteContext<"/api/pyth/get-pyth-feeds-demo-data/[symbol]/[datasource]">,
) => {
  const { datasource, symbol } = await ctx.params;
  const datasourceValidation =
    await DATA_SOURCES_HISTORICAL.safeParseAsync(datasource);
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
  const limit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const datasourceToUse = datasourceValidation.data;
  const symbolToUse = symbolValidation.data;

  const data = await fetchHistoricalDataForPythFeedsDemo({
    datasource: datasourceToUse,
    limit,
    startAt,
    symbol: symbolToUse,
  });

  return NextResponse.json(data);
};
