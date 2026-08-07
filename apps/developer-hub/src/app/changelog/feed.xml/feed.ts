// Pure RSS 2.0 serialization for the changelog feed. Kept free of Next.js
// request/response types, the fumadocs `.source` bundle, and react-dom/server
// so it can be unit-tested in isolation; the route handler renders each entry
// body to an HTML string and hands it here as `contentHtml`.

export const escapeXml = (value: string): string =>
  value
    // `&` must be escaped first, otherwise the `&` in the entities produced by
    // the later replacements would themselves be double-escaped.
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export type RssItem = {
  title: string;
  /** Canonical permalink; also used as the guid. */
  link: string;
  /** RFC-822 date string. */
  pubDate: string;
  /** Plain category labels — escaped here. */
  categories: string[];
  /** Pre-rendered HTML for `<content:encoded>` — escaped here. */
  contentHtml: string;
};

export type RssChannel = {
  title: string;
  description: string;
  /** Human-facing page URL. */
  link: string;
  /** Canonical self URL of this feed. */
  self: string;
  /** RFC-822 date string. */
  lastBuildDate: string;
};

const renderItem = (item: RssItem): string =>
  [
    "<item>",
    `<title>${escapeXml(item.title)}</title>`,
    `<link>${item.link}</link>`,
    `<guid isPermaLink="true">${item.link}</guid>`,
    `<pubDate>${item.pubDate}</pubDate>`,
    item.categories
      .map((category) => `<category>${escapeXml(category)}</category>`)
      .join(""),
    `<content:encoded>${escapeXml(item.contentHtml)}</content:encoded>`,
    "</item>",
  ].join("");

export const buildFeedXml = (channel: RssChannel, items: RssItem[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${escapeXml(channel.title)}</title>`,
    `<link>${channel.link}</link>`,
    `<atom:link href="${channel.self}" rel="self" type="application/rss+xml"/>`,
    `<description>${escapeXml(channel.description)}</description>`,
    `<lastBuildDate>${channel.lastBuildDate}</lastBuildDate>`,
    items.map(renderItem).join("\n"),
    "</channel>",
    "</rss>",
  ].join("\n");
