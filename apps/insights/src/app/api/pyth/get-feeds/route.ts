import { NextResponse } from "next/server";
import { stringify } from 'superjson';
import type { z } from 'zod';

import { getFeedsCached } from "../../../../server/pyth/get-feeds";
import { Cluster, priceFeedsSchema } from "../../../../services/pyth";

export const GET = async (request: Request) => {
  // get cluster from query params
  const { searchParams } = new URL(request.url);
  const excludePriceComponents = searchParams.get("excludePriceComponents") === "true";
  const cluster = Number.parseInt(searchParams.get("cluster") ?? Cluster.Pythnet.toString()) as Cluster;
  // check if cluster is valid
  if (cluster && !Object.values(Cluster).includes(cluster)) {
    return NextResponse.json({ error: "Invalid cluster" }, { status: 400 });
  }

  let feeds = await getFeedsCached(cluster) as Omit<z.infer<typeof priceFeedsSchema>[number], 'price'>[];
  if(excludePriceComponents) {
    feeds = feeds.map((feed) => ({
      ...feed,
      price: undefined,
    }));
  }
  return new Response(stringify(feeds), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};