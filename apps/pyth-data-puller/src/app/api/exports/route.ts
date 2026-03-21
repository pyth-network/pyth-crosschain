import { NextResponse } from "next/server";
import { listExports } from "../../../lib/db";

export function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(
    Number.parseInt(url.searchParams.get("limit") ?? "20", 10),
    100,
  );
  const offset = Math.max(
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10),
    0,
  );

  const result = listExports(limit, offset);

  return NextResponse.json({
    exports: result.exports,
    limit,
    offset,
    total: result.total,
  });
}
