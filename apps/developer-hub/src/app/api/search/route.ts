import type { AdvancedIndex } from "fumadocs-core/search/server";
import { createSearchAPI } from "fumadocs-core/search/server";
import { z } from "zod";

import { source } from "../../../lib/source";

// Define schemas for type safety
const hermesSchema = z.array(
  z.object({
    attributes: z.object({ symbol: z.string() }),
    id: z.string(),
  }),
);

const lazerSchema = z.array(
  z.object({
    description: z.string(),
    name: z.string(),
    pyth_lazer_id: z.number(),
    symbol: z.string(),
  }),
);

function toAdvancedIndex(
  fee: z.infer<typeof hermesSchema>[number],
): AdvancedIndex {
  return {
    description: `Price Feed ID: ${fee.id}`,
    id: fee.id,
    structuredData: {
      contents: [
        { content: fee.attributes.symbol, heading: "Symbol" },
        { content: fee.id, heading: "ID" },
      ],
      headings: [],
    },
    tag: "price-feed-core",
    title: `${fee.attributes.symbol} (Core)`,
    url: `/price-feeds/core/price-feeds/price-feed-ids?search=${fee.attributes.symbol}`,
  };
}

async function getHermesFeeds(): Promise<AdvancedIndex[]> {
  try {
    const results = await Promise.all(
      ["https://hermes.pyth.network", "https://hermes-beta.pyth.network"].map(
        async (url): Promise<AdvancedIndex[]> => {
          const hermesResult = await fetch(new URL("/v2/price_feeds", url), {
            next: { revalidate: 3600 },
          });
          const parsed = hermesSchema.safeParse(await hermesResult.json());
          return parsed.success
            ? parsed.data.map((feed) => toAdvancedIndex(feed))
            : [];
        },
      ),
    );

    return results.flat();
  } catch (error: unknown) {
    throw new Error("Failed to fetch Hermes feeds", { cause: error });
  }
}

async function getLazerFeeds(): Promise<AdvancedIndex[]> {
  try {
    const res = await fetch(
      "https://history.pyth-lazer.dourolabs.app/history/v1/symbols",
      { next: { revalidate: 3600 } },
    );
    const parsed = lazerSchema.safeParse(await res.json());

    if (!parsed.success) {
      return [];
    }

    return parsed.data.map((feed) => ({
      description: `${feed.symbol} - ${feed.description} (ID: ${String(feed.pyth_lazer_id)})`,
      id: `lazer-${String(feed.pyth_lazer_id)}`,
      structuredData: {
        contents: [
          { content: feed.symbol, heading: "Symbol" },
          { content: feed.name, heading: "Name" },
          { content: feed.description, heading: "Description" },
          { content: String(feed.pyth_lazer_id), heading: "ID" },
        ],
        headings: [],
      },
      tag: "price-feed-pro",
      title: `${feed.name} (Pro)`,
      url: `/price-feeds/pro/price-feed-ids?search=${feed.symbol}`,
    }));
  } catch (error: unknown) {
    throw new Error("Failed to fetch Lazer feeds", { cause: error });
  }
}

export const { GET } = createSearchAPI("advanced", {
  indexes: async () => {
    const staticPages = source.getPages().map((page) => ({
      description: page.data.description,
      id: page.url,
      structuredData: page.data.structuredData,
      title: page.data.title,
      url: page.url,
    })) as AdvancedIndex[];

    // Added these two functions to get the price feeds from the Hermes and Pro APIs
    const [hermesFeeds, lazerFeeds] = await Promise.all([
      getHermesFeeds(),
      getLazerFeeds(),
    ]);

    // Combine the static pages, Hermes feeds, and Pro feeds
    return [...staticPages, ...hermesFeeds, ...lazerFeeds];
  },
});
