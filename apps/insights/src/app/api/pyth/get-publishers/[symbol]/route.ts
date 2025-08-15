import { NextResponse } from "next/server";

import { Cluster } from "../../../../../services/pyth";
import { getPublishersForCluster } from "../../../../../services/pyth/get-publishers-for-cluster";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) => {
  const { symbol } = await params;
  // get cluster from query params
  const { searchParams } = new URL(request.url);
  const cluster = Number.parseInt(
    searchParams.get("cluster") ?? Cluster.Pythnet.toString(),
  ) as Cluster;

  // check if cluster is valid
  if (cluster && !Object.values(Cluster).includes(cluster)) {
    return NextResponse.json({ error: "Invalid cluster" }, { status: 400 });
  }

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  const map = await getPublishersForCluster(cluster);

  return NextResponse.json(map[symbol] ?? []);
};
