import { parse } from "superjson";
import { z } from "zod";

import { DEFAULT_NEXT_FETCH_TTL } from "../cache";
import { VERCEL_REQUEST_HEADERS } from "../config/server";
import { getHost } from "../get-host";
import { priceFeedsSchema } from "../schemas/pyth/price-feeds-schema";
import { Cluster, ClusterToName } from "../services/pyth";

export async function getPublishersForFeedRequest(
  cluster: Cluster,
  symbol: string,
) {
  const data = await fetchPythData(
    cluster,
    `get-publishers/${encodeURIComponent(symbol)}`,
  );
  return z.array(z.string()).parse(await data.json());
}

export const getPublishers = async (cluster: Cluster) => {
  const data = await fetchPythData(cluster, `get-publishers`);
  return publishersSchema.parse(await data.json());
};

const publishersSchema = z.array(
  z.strictObject({
    key: z.string(),
    permissionedFeeds: z.number(),
  }),
);

export async function getFeedsForPublisherRequest(
  cluster: Cluster,
  publisher: string,
) {
  const data = await fetchPythData(
    cluster,
    `get-feeds-for-publisher/${encodeURIComponent(publisher)}`,
  );
  const rawData = await data.text();
  const parsedData = parse(rawData);
  return priceFeedsSchema.parse(parsedData);
}

export const getFeedsRequest = async (cluster: Cluster) => {
  const data = await fetchPythData(cluster, "get-feeds", {
    excludePriceComponents: "true",
  });

  const rawData = await data.text();
  const parsedData = parse(rawData);

  return priceFeedsSchema.element
    .omit({ price: true })
    .array()
    .parse(parsedData);
};

export const getFeedForSymbolRequest = async ({
  symbol,
  cluster = Cluster.Pythnet,
}: {
  symbol: string;
  cluster?: Cluster;
}): Promise<z.infer<typeof priceFeedsSchema.element> | undefined> => {
  const data = await fetchPythData(
    cluster,
    `get-feeds/${encodeURIComponent(symbol)}`,
  );

  if (!data.ok) {
    return undefined;
  }

  const rawData = await data.text();
  const parsedData = parse(rawData);
  return parsedData === undefined
    ? undefined
    : priceFeedsSchema.element.parse(parsedData);
};

const fetchPythData = async (
  cluster: Cluster,
  path: string,
  params?: Record<string, string>,
) => {
  const url = new URL(`/api/pyth/${path}`, await getHost());
  url.searchParams.set("cluster", ClusterToName[cluster]);
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return await fetch(url, {
    next: { revalidate: DEFAULT_NEXT_FETCH_TTL },
    headers: VERCEL_REQUEST_HEADERS,
  });
};
