import type { NextRequest } from "next/server";
import { z } from "zod";

import { getHistory } from "../../../../services/clickhouse";

const queryParamsSchema = z.object({
  symbol: z.string(),
  range: z.enum(["1H", "1D", "1W", "1M"]),
  cluster: z.enum(["pythnet", "pythtest-conformance"]),
  from: z.string().transform(Number),
  until: z.string().transform(Number),
});

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  
  // Parse and validate query parameters
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range");
  const cluster = searchParams.get("cluster");
  const from = searchParams.get("from");
  const until = searchParams.get("until");

  if (!symbol || !range || !cluster) {
    return new Response(
      "Missing required parameters. Must provide `symbol`, `range`, and `cluster`",
      { status: 400 }
    );
  }

  try {
    // Validate parameters using the schema
    const validatedParams = queryParamsSchema.parse({
      symbol,
      range,
      cluster,
      from,
      until,
    });

    const data = await getHistory({
      symbol: validatedParams.symbol,
      range: validatedParams.range,
      cluster: validatedParams.cluster,
      from: validatedParams.from,
      until: validatedParams.until,
    });

    return Response.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        `Invalid parameters: ${error.errors.map(e => e.message).join(", ")}`,
        { status: 400 }
      );
    }
    
    console.error("Error fetching history data:", error);
    return new Response(
      "Internal server error",
      { status: 500 }
    );
  }
}
