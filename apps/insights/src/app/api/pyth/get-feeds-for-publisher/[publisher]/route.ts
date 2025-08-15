import { NextRequest, NextResponse } from "next/server";
import { stringify } from "superjson";

import { Cluster, parseCluster } from "../../../../../services/pyth";
import { getFeeds } from "../../../../../services/pyth/get-feeds";

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ publisher: string }> },
) => {
  const { publisher } = await params;
  const clusterName = request.nextUrl.searchParams.get("cluster");

  const cluster =
    clusterName === null ? Cluster.Pythnet : parseCluster(clusterName);

  if (cluster === undefined) {
    return NextResponse.json({ error: "Invalid Cluster" }, { status: 400 });
  }

  if (!publisher) {
    return NextResponse.json(
      { error: "Publisher is required" },
      { status: 400 },
    );
  }

  const feeds = await getFeeds(cluster);

  const filteredFeeds = feeds.filter((feed) =>
    feed.price.priceComponents.some((c) => c.publisher === publisher),
  );

  return new Response(stringify(filteredFeeds), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
