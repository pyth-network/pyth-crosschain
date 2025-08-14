import { NextResponse } from "next/server";

import { getPublishersForClusterCached } from "../../../../../server/pyth/get-publishers-for-cluster";
import { Cluster } from "../../../../../services/pyth";

export const GET = async (request: Request, { params }: { params: Promise<{ symbol: string }> }) => {
  const { symbol } = await params;
  // get cluster from query params
  const { searchParams } = new URL(request.url);
  const cluster = Number.parseInt(searchParams.get("cluster") ?? Cluster.Pythnet.toString()) as Cluster;

  // check if cluster is valid
  if (cluster && !Object.values(Cluster).includes(cluster)) {
    return NextResponse.json({ error: "Invalid cluster" }, { status: 400 });
  }

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  const map = await getPublishersForClusterCached(cluster);

  return NextResponse.json(map[symbol] ?? []);
};