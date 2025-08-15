import { NextRequest } from "next/server";
import { stringify } from "superjson";
import { z } from "zod";
import { parseSearchParams } from "zod-search-params";

import {
  Cluster,
  CLUSTER_NAMES,
  ClusterToName,
  toCluster,
} from "../../../../../services/pyth";
import { getFeeds } from "../../../../../services/pyth/get-feeds";

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) => {
  const { symbol } = await params;
  const searchParams = request.nextUrl.searchParams;
  const parsedSearchParams = parseSearchParams(queryParamsSchema, searchParams);

  if (!parsedSearchParams) {
    return new Response("Invalid params", {
      status: 400,
    });
  }

  const { cluster } = parsedSearchParams;

  const feeds = await getFeeds(cluster);
  const feed = feeds.find((feed) => feed.symbol === symbol);

  return new Response(stringify(feed), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};

const queryParamsSchema = z.object({
  cluster: z
    .enum(CLUSTER_NAMES)
    .transform((value) => toCluster(value))
    .default(ClusterToName[Cluster.Pythnet]),
});
