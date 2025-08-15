import { NextResponse } from "next/server";
import { stringify } from "superjson";

import { Cluster } from "../../../../services/pyth";
import { getFeeds } from "../../../../services/pyth/get-feeds";

export const GET = async (request: Request) => {
  // get cluster from query params
  const { searchParams } = new URL(request.url);
  const excludePriceComponents =
    searchParams.get("excludePriceComponents") === "true";
  const cluster = Number.parseInt(
    searchParams.get("cluster") ?? Cluster.Pythnet.toString(),
  ) as Cluster;

  // check if cluster is valid
  if (cluster && !Object.values(Cluster).includes(cluster)) {
    return NextResponse.json({ error: "Invalid cluster" }, { status: 400 });
  }

  const feeds = await getFeeds(cluster);
  const filteredFeeds = excludePriceComponents
    ? feeds.map((feed) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { price, ...rest } = feed;
        return rest;
      })
    : feeds;

  return new Response(stringify(filteredFeeds), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
