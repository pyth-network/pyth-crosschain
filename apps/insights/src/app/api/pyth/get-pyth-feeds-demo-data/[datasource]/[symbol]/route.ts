import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { NextRequest, NextResponse } from "next/server";

import { fetchHistoricalDataForPythFeedsDemo } from "../../../../../../pyth-feed-demo-data/fetch-historical-data-from-db";
import {
  ALLOWED_EQUITY_SYMBOLS,
  DATA_SOURCES_REPLAY,
  ValidDateSchema,
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

  const startAtDate = new Date(startAtParam);

  const startAtValidation = await ValidDateSchema.safeParseAsync(startAtDate);
  if (startAtValidation.error) {
    return NextResponse.json(
      {
        error: `startAt query parameter is not a valid ISO date string: ${startAtValidation.error.message}`,
      },
      { status: 400 },
    );
  }

  const startAt = startAtValidation.data;

  const symbolToUse = symbolValidation.data;
  const datasourceToUse = datasourceValidation.data;

  try {
    const { data, hasNext } = await fetchHistoricalDataForPythFeedsDemo({
      datasource: datasourceToUse,
      startAt: startAt.toISOString(),
      symbol: symbolToUse,
    });

    return NextResponse.json({
      data,
      hasNext,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
};
