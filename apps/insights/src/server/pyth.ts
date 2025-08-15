import { parse } from "superjson";
import { z } from "zod";

import { PUBLIC_URL, VERCEL_AUTOMATION_BYPASS_SECRET } from "../config/server";
import { Cluster, priceFeedsSchema } from "../services/pyth";
import { DEFAULT_CACHE_TTL } from "../utils/cache";

export async function getPublishersForFeedRequest(
  cluster: Cluster,
  symbol: string,
) {
  const data = await fetch(
    `${PUBLIC_URL}/api/pyth/get-publishers/${encodeURIComponent(symbol)}?cluster=${cluster.toString()}`,
    {
      next: {
        revalidate: DEFAULT_CACHE_TTL,
      },
      headers: {
        // this is a way to bypass vercel protection for the internal api route
        "x-vercel-protection-bypass": VERCEL_AUTOMATION_BYPASS_SECRET,
      },
    },
  );
  const parsedData: unknown = await data.json();
  return z.array(z.string()).parse(parsedData);
}

export async function getFeedsForPublisherRequest(
  cluster: Cluster,
  publisher: string,
) {
  const data = await fetch(
    `${PUBLIC_URL}/api/pyth/get-feeds-for-publisher/${encodeURIComponent(publisher)}?cluster=${cluster.toString()}`,
    {
      next: {
        revalidate: DEFAULT_CACHE_TTL,
      },
      headers: {
        // this is a way to bypass vercel protection for the internal api route
        "x-vercel-protection-bypass": VERCEL_AUTOMATION_BYPASS_SECRET,
      },
    },
  );
  const rawData = await data.text();
  const parsedData = parse(rawData);
  return priceFeedsSchema.parse(parsedData);
}

export const getFeedsRequest = async (cluster: Cluster) => {
  const data = await fetch(
    `${PUBLIC_URL}/api/pyth/get-feeds?cluster=${cluster.toString()}&excludePriceComponents=true`,
    {
      next: {
        revalidate: DEFAULT_CACHE_TTL,
      },
      headers: {
        // this is a way to bypass vercel protection for the internal api route
        "x-vercel-protection-bypass": VERCEL_AUTOMATION_BYPASS_SECRET,
      },
    },
  );
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
}): Promise<z.infer<typeof priceFeedsSchema>[0] | undefined> => {
  const data = await fetch(
    `${PUBLIC_URL}/api/pyth/get-feeds/${encodeURIComponent(symbol)}?cluster=${cluster.toString()}`,
    {
      next: {
        revalidate: DEFAULT_CACHE_TTL,
      },
      headers: {
        // this is a way to bypass vercel protection for the internal api route
        "x-vercel-protection-bypass": VERCEL_AUTOMATION_BYPASS_SECRET,
      },
    },
  );

  if (!data.ok) {
    return undefined;
  }

  const rawData = await data.text();
  const parsedData = parse(rawData);
  return priceFeedsSchema.element.parse(parsedData);
};
