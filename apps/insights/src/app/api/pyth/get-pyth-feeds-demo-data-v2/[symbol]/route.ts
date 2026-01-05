import { NextRequest, NextResponse } from "next/server";

import { GetPythFeedsDemoDataRequestSchema } from "../../../../../schemas/pyth/pyth-pro-demo-schema";
import { getPythProHistoricalPrices } from "../../../../../services/clickhouse";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) {
  const params = await ctx.params;

  const {
    nextUrl: { searchParams },
  } = req;
  const dataSourcesToUse = searchParams.getAll("datasources[]");

  const query = {
    ...Object.fromEntries(searchParams),
    datasources: dataSourcesToUse,
  };

  const validatedParams = GetPythFeedsDemoDataRequestSchema.safeParse({
    params,
    searchParams: query,
  });

  if (validatedParams.error) {
    return NextResponse.json(
      { error: validatedParams.error.format() },
      { status: 400 },
    );
  }

  const {
    data: {
      params: { symbol },
      searchParams: { datasources, startAt },
    },
  } = validatedParams;

  const end = new Date(startAt);
  // enforce the end time for this API,
  // when called by a public user,
  // only allows for 1 minute beyond the startAt.
  end.setTime(end.getTime() + 1000 * 60);

  try {
    const response = await getPythProHistoricalPrices({
      end,
      sources: datasources,
      start: startAt,
      symbol,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message || error },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
