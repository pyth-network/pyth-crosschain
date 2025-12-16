import { NextRequest, NextResponse } from "next/server";

import { fetchHistoricalDataForPythFeedsDemo } from "../../../../../../pyth-feed-demo-data/fetch-historical-data-from-db";
import type { GetPythFeedsDemoDataRequestType } from "../../../../../../schemas/pyth/pyth-pro-demo-schema";
import { GetPythFeedsDemoDataRequestSchema } from "../../../../../../schemas/pyth/pyth-pro-demo-schema";

export const GET = async (
  req: NextRequest,
  ctx: { params: Promise<GetPythFeedsDemoDataRequestType["params"]> },
) => {
  const params = await ctx.params;
  const {
    nextUrl: { searchParams },
  } = req;
  const paramsAndQueryValidation = GetPythFeedsDemoDataRequestSchema.safeParse({
    params,
    searchParams: Object.fromEntries(searchParams),
  });

  if (paramsAndQueryValidation.error) {
    return NextResponse.json(
      {
        error: paramsAndQueryValidation.error.message,
      },
      { status: 400 },
    );
  }

  const {
    params: { datasource: datasourceToUse, symbol: symbolToUse },
    searchParams: { startAt },
  } = paramsAndQueryValidation.data;

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
