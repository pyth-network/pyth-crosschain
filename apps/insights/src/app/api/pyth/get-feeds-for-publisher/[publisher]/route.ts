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
  { params }: { params: Promise<{ publisher: string }> },
) => {
  const { publisher } = await params;
  const searchParams = request.nextUrl.searchParams;
  const parsedSearchParams = parseSearchParams(queryParamsSchema, searchParams);

  if (!parsedSearchParams) {
    return new Response("Invalid params", {
      status: 400,
    });
  }

  const { cluster } = parsedSearchParams;

  if (!publisher) {
    return new Response("Publisher is required", {
      status: 400,
    });
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

const queryParamsSchema = z.object({
  cluster: z
    .enum(CLUSTER_NAMES)
    .transform((value) => toCluster(value))
    .default(ClusterToName[Cluster.Pythnet]),
});
