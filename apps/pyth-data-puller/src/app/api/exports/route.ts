import { NextResponse } from "next/server";
import { listExports } from "../../../lib/db";

export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
    const rawOffset = Number.parseInt(
      url.searchParams.get("offset") ?? "0",
      10,
    );
    const limit = Math.max(
      Math.min(Number.isNaN(rawLimit) ? 20 : rawLimit, 100),
      1,
    );
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    const result = listExports(limit, offset);

    return NextResponse.json({
      exports: result.exports,
      limit,
      offset,
      total: result.total,
    });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
