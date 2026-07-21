import type { AdvancedIndex } from "fumadocs-core/search/server";
import { createSearchAPI } from "fumadocs-core/search/server";

import type { HermesFeed, LazerFeed, PriceFeedsSnapshot } from "./feed-schemas";
import priceFeeds from "../../../generated/price-feeds.json";
import { source } from "../../../lib/source";

// Feed lists are fetched at build time by
// `scripts/generate-price-feeds-snapshot.ts` and imported statically here, so
// the search route performs zero external HTTP calls at runtime.
const snapshot = priceFeeds as PriceFeedsSnapshot;

function hermesToAdvancedIndex(fee: HermesFeed): AdvancedIndex {
  return {
    title: `${fee.attributes.symbol} (Core)`,
    description: `Price Feed ID: ${fee.id}`,
    url: `/price-feeds/core/price-feeds/price-feed-ids?search=${fee.attributes.symbol}`,
    id: fee.id,
    tag: "price-feed-core",
    structuredData: {
      headings: [],
      contents: [
        { heading: "Symbol", content: fee.attributes.symbol },
        { heading: "ID", content: fee.id },
      ],
    },
  };
}

function lazerToAdvancedIndex(feed: LazerFeed): AdvancedIndex {
  return {
    title: `${feed.name} (Pro)`,
    description: `${feed.symbol} - ${feed.description} (ID: ${String(feed.pyth_lazer_id)})`,
    url: `/price-feeds/pro/price-feed-ids?search=${feed.symbol}`,
    id: `lazer-${String(feed.pyth_lazer_id)}`,
    tag: "price-feed-pro",
    structuredData: {
      headings: [],
      contents: [
        { heading: "Symbol", content: feed.symbol },
        { heading: "Name", content: feed.name },
        { heading: "Description", content: feed.description },
        { heading: "ID", content: String(feed.pyth_lazer_id) },
      ],
    },
  };
}

export const { GET } = createSearchAPI("advanced", {
  indexes: () => {
    const staticPages = source.getPages().map((page) => ({
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      id: page.url,
      structuredData: page.data.structuredData,
    })) as AdvancedIndex[];

    const hermesFeeds = [...snapshot.hermes, ...snapshot.hermesBeta].map(
      (feed) => hermesToAdvancedIndex(feed),
    );
    const lazerFeeds = snapshot.lazer.map((feed) => lazerToAdvancedIndex(feed));

    return [...staticPages, ...hermesFeeds, ...lazerFeeds];
  },
});
