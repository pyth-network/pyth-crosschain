import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Cluster } from "../../../../services/pyth";
import { CLUSTER_NAMES, toCluster } from "../../../../services/pyth";
import { getFeedsByPublisherForCluster } from "../../../../services/pyth/get-publishers-for-cluster";

export const GET = async (request: NextRequest) => {
  const cluster = clusterSchema.safeParse(
    request.nextUrl.searchParams.get("cluster"),
  );

  return cluster.success
    ? NextResponse.json(await getPublishers(cluster.data))
    : new Response("Invalid params", { status: 400 });
};

const clusterSchema = z
  .enum(CLUSTER_NAMES)
  .transform((value) => toCluster(value));

const getPublishers = async (cluster: Cluster) =>
  Object.entries(await getFeedsByPublisherForCluster(cluster)).map(
    ([key, feeds]) => ({ key, permissionedFeeds: feeds.length }),
  );
