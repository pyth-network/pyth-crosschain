import { NextResponse } from "next/server";
import { stringify } from 'superjson';

import { getPublishersForCluster } from "../../../../server/pyth/get-publishers-for-cluster";
import { Cluster } from "../../../../services/pyth";

export const GET = async (request: Request) => {
  // get cluster from query params
  const { searchParams } = new URL(request.url);
  const cluster = Number.parseInt(searchParams.get("cluster") ?? Cluster.Pythnet.toString()) as Cluster;
  // check if cluster is valid
  if (cluster && !Object.values(Cluster).includes(cluster)) {
    return NextResponse.json({ error: "Invalid cluster" }, { status: 400 });
  }
  const publishers = await getPublishersForCluster(cluster);
  return new Response(stringify(publishers), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};