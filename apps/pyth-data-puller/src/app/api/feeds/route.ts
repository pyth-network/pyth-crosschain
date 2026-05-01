import { NextResponse } from "next/server";
import { fetchFeeds } from "../../../lib/feeds";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.toLowerCase() ?? "";
    const assetType = url.searchParams.get("asset_type")?.toLowerCase() ?? "";

    const allFeeds = await fetchFeeds();

    let filtered = allFeeds;

    if (query) {
      filtered = filtered.filter(
        (f) =>
          f.pyth_lazer_id.toString().includes(query) ||
          f.symbol?.toLowerCase().includes(query) ||
          f.name?.toLowerCase().includes(query) ||
          f.description?.toLowerCase().includes(query),
      );
    }

    if (assetType) {
      filtered = filtered.filter(
        (f) => f.asset_type?.toLowerCase() === assetType,
      );
    }

    return NextResponse.json({
      feeds: filtered,
      total: filtered.length,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Feed catalog temporarily unavailable. Try again in a few minutes.",
      },
      { status: 503 },
    );
  }
}
