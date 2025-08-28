import { NextRequest } from "next/server";
import { stringify } from "superjson";
import { z } from "zod";
import { parseSearchParams } from "zod-search-params";

import { CLUSTER_NAMES, toCluster } from "../../../../services/pyth";
import { getFeeds } from "../../../../services/pyth/get-feeds";

export const GET = async (request: NextRequest) => {
  // get cluster from query params
  const searchParams = request.nextUrl.searchParams;
  const parsedSearchParams = parseSearchParams(queryParamsSchema, searchParams);

  if (!parsedSearchParams) {
    return new Response("Invalid params", {
      status: 400,
    });
  }

  const { excludePriceComponents, cluster } = parsedSearchParams;

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

const queryParamsSchema = z.object({
  cluster: z.enum(CLUSTER_NAMES).transform((value) => toCluster(value)),
  excludePriceComponents: z.boolean().optional().default(false),
});
