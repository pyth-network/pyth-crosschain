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
  const url = new URL(
    `/api/pyth/get-publishers/${encodeURIComponent(symbol)}`,
    await getHost(),
  );
  url.searchParams.set("cluster", ClusterToName[cluster]);

  const data = await fetch(url, {
    next: {
      revalidate: DEFAULT_NEXT_FETCH_TTL,
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
  const url = new URL(
    `/api/pyth/get-feeds-for-publisher/${encodeURIComponent(publisher)}`,
    await getHost(),
  );
  url.searchParams.set("cluster", ClusterToName[cluster]);

  const data = await fetch(url, {
    next: {
      revalidate: DEFAULT_NEXT_FETCH_TTL,
    },
    headers: VERCEL_REQUEST_HEADERS,
  });
  const rawData = await data.text();
  const parsedData = parse(rawData);
  return priceFeedsSchema.parse(parsedData);
}

export const getFeedsRequest = async (cluster: Cluster) => {
  const url = new URL(`/api/pyth/get-feeds`, await getHost());
  url.searchParams.set("cluster", ClusterToName[cluster]);
  url.searchParams.set("excludePriceComponents", "true");

  const data = await fetch(url, {
    next: {
      revalidate: DEFAULT_NEXT_FETCH_TTL,
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
  const url = new URL(
    `/api/pyth/get-feeds/${encodeURIComponent(symbol)}`,
    await getHost(),
  );
  url.searchParams.set("cluster", ClusterToName[cluster]);

  const data = await fetch(url, {
    next: {
      revalidate: DEFAULT_NEXT_FETCH_TTL,
    },
    headers: VERCEL_REQUEST_HEADERS,
  });

  if (!data.ok) {
    return undefined;
  }

  const rawData = await data.text();
  const parsedData = parse(rawData);
  return parsedData === undefined
    ? undefined
    : priceFeedsSchema.element.parse(parsedData);
};
