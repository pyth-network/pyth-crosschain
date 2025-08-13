import { NextResponse } from "next/server";
import { stringify } from "superjson";

import { getFeedsCached } from '../../../../../server/pyth/get-feeds';
import { Cluster } from "../../../../../services/pyth";

export const GET = async (request: Request, { params }: { params: Promise<{ publisher: string }> }) => {
  const { publisher } = await params;
  const { searchParams } = new URL(request.url);
  const cluster = Number.parseInt(searchParams.get("cluster") ?? Cluster.Pythnet.toString()) as Cluster;

  // check if cluster is valid
  if (cluster && !Object.values(Cluster).includes(cluster)) {
    return NextResponse.json({ error: "Invalid cluster" }, { status: 400 });
  }

  if (!publisher) {
    return NextResponse.json({ error: "Publisher is required" }, { status: 400 });
  } 

  const feeds = await getFeedsCached(cluster);

  const filteredFeeds = feeds.filter((feed) => feed.price.priceComponents.some((c) => c.publisher === publisher));
  
  return new Response(stringify(filteredFeeds), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};