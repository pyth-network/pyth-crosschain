import { NextRequest, NextResponse } from "next/server";

import { fetchHistoricalDataForPythFeedsDemo } from "../../../../../pyth-feed-demo-data/fetch-historical-data-from-db";
import { GetPythFeedsDemoDataRequestSchema } from "../../../../../schemas/pyth/pyth-pro-demo-schema";

export const GET = async (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => {
  const params = await ctx.params;
  const {
    nextUrl: { searchParams },
  } = req;

  const searchParamsToUse = {
    ...Object.fromEntries(searchParams),
    datasources: searchParams.getAll("datasources[]"),
  };

  const paramsAndQueryValidation = GetPythFeedsDemoDataRequestSchema.safeParse({
    params,
    searchParams: searchParamsToUse,
  });

  if (paramsAndQueryValidation.error) {
    return NextResponse.json(
      {
        error: paramsAndQueryValidation.error.format(),
      },
      { status: 400 },
    );
  }

  const {
    params: { symbol: symbolToUse },
    searchParams: { datasources, startAt },
  } = paramsAndQueryValidation.data;

  try {
    const { data, hasNext } = await fetchHistoricalDataForPythFeedsDemo({
      datasources,
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
