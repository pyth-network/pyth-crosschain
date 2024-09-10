import { NextResponse } from "next/server";

export async function GET() {
  const publisherRankingsResponse = await fetch(
    "https://www.pyth.network/api/publishers-ranking?cluster=pythnet",
  );

  const publisherRankings = (await publisherRankingsResponse.json()) as JSON;
  return NextResponse.json(publisherRankings);
}
