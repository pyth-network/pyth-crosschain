import { parse } from "superjson";
import { z } from "zod";

import { VERCEL_REQUEST_HEADERS } from "../config/server";
import { Cluster, ClusterToName, priceFeedsSchema } from "../services/pyth";
import { absoluteUrl } from "../utils/absolute-url";
import { DEFAULT_CACHE_TTL } from "../utils/cache";

export async function getPublishersForFeedRequest(
  cluster: Cluster,
  symbol: string,
) {
  const url = await absoluteUrl(
    `/api/pyth/get-publishers/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("cluster", ClusterToName[cluster]);

  const data = await fetch(url, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: VERCEL_REQUEST_HEADERS,
  });
  const parsedData: unknown = await data.json();
  return z.array(z.string()).parse(parsedData);
}

export async function getFeedsForPublisherRequest(
  cluster: Cluster,
  publisher: string,
) {
  const url = await absoluteUrl(
    `/api/pyth/get-feeds-for-publisher/${encodeURIComponent(publisher)}`,
  );
  url.searchParams.set("cluster", ClusterToName[cluster]);

  const data = await fetch(url, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: VERCEL_REQUEST_HEADERS,
  });
  const rawData = await data.text();
  const parsedData = parse(rawData);
  return priceFeedsSchema.parse(parsedData);
}

export const getFeedsRequest = async (cluster: Cluster) => {
  const url = await absoluteUrl(`/api/pyth/get-feeds`);
  url.searchParams.set("cluster", ClusterToName[cluster]);
  url.searchParams.set("excludePriceComponents", "true");

  const data = await fetch(url, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: VERCEL_REQUEST_HEADERS,
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
  const url = await absoluteUrl(
    `/api/pyth/get-feeds/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("cluster", ClusterToName[cluster]);

  const data = await fetch(url, {
    next: {
      revalidate: DEFAULT_CACHE_TTL,
    },
    headers: VERCEL_REQUEST_HEADERS,
  });

  if (!data.ok) {
    return undefined;
  }

  const rawData = await data.text();
  const parsedData = parse(rawData);
  return priceFeedsSchema.element.parse(parsedData);
};
