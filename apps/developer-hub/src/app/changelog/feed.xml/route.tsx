import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

import type { ChangelogProduct } from "../../../lib/changelog";
import {
  AREA_LABELS,
  CHANGELOG_PATH,
  CHANGELOG_PRODUCTS,
  feedUrl,
  PRODUCT_LABELS,
  SITE,
  TYPE_LABELS,
} from "../../../lib/changelog";
import { getChangelogEntries } from "../../../lib/changelog-data";

const DESCRIPTION = "Product updates across Pyth Pro, Pyth Core, and Entropy.";

// Minimal, fully server-renderable component map for RSS content. Fumadocs'
// getMDXComponents() pulls in *client* components (CodeBlock, Tabs, Link, …)
// that renderToStaticMarkup cannot call from a server route. Here every MDX
// element falls back to an intrinsic HTML tag, which is exactly what an RSS
// reader wants inside <content:encoded>. Anything not covered (a future custom
// component in an entry) throws and is caught per-entry below.
const rssComponents: MDXComponents = {
  // Root-relative doc links must be absolutized: RSS content is read outside
  // the site, so a bare "/price-feeds/…" would resolve against the reader's
  // own origin (or dead-link) rather than docs.pyth.network.
  a: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={href?.startsWith("/") ? `${SITE}${href}` : href} {...rest}>
      {children}
    </a>
  ),
  // rehypeCode annotates <pre>/<code> with fumadocs-specific props (icon,
  // data-*) intended for the interactive CodeBlock. Drop them and keep the
  // shiki-highlighted <span> children as plain, valid HTML.
  code: ({ children, className }: ComponentProps<"code">) => (
    <code className={className}>{children}</code>
  ),
  // source.config rewrites ```mermaid fences into <MermaidDiagram src=… />.
  MermaidDiagram: ({ src, alt }: { src?: string; alt?: string }) => (
    <img alt={alt ?? "Mermaid diagram"} src={src} />
  ),
  pre: ({ children }: ComponentProps<"pre">) => <pre>{children}</pre>,
};

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

// RSS 2.0 feed for the cross-product changelog. `/changelog/feed.xml` covers
// all products; `?product=pyth-pro|pyth-core|entropy` narrows it — this is
// what the Subscribe menu links to.
export const GET = async (request: Request): Promise<Response> => {
  // Loaded dynamically: Next.js rejects a static `react-dom/server` import
  // anywhere in the app module graph, but a route handler is a plain Node
  // function — rendering entry bodies to HTML strings here is exactly what
  // renderToStaticMarkup is for.
  const { renderToStaticMarkup } = await import("react-dom/server");
  // A bare `?product=` yields "" (not null); treat it as absent so it serves
  // the all-products feed rather than 400-ing, matching feedUrl's contract.
  const productParam = new URL(request.url).searchParams.get("product") || null;
  if (
    productParam !== null &&
    !(CHANGELOG_PRODUCTS as readonly string[]).includes(productParam)
  ) {
    return new Response(
      `Unknown product "${productParam}". Expected one of: ${CHANGELOG_PRODUCTS.join(", ")}.`,
      { headers: { "Content-Type": "text/plain" }, status: 400 },
    );
  }
  const product = productParam as ChangelogProduct | null;

  const entries = getChangelogEntries().filter(
    (entry) => product === null || entry.product === product,
  );

  const title =
    product === null
      ? "Pyth Changelog"
      : `Pyth Changelog — ${PRODUCT_LABELS[product]}`;
  const description =
    product === null
      ? DESCRIPTION
      : `Product updates for ${PRODUCT_LABELS[product]}.`;
  const self = `${SITE}${feedUrl(product ?? undefined)}`;
  const latest = entries[0]?.date;
  const lastBuildDate = latest
    ? new Date(`${latest}T00:00:00Z`).toUTCString()
    : new Date().toUTCString();

  const items = entries
    .map((entry) => {
      const Body = entry.body;
      const link = `${SITE}${CHANGELOG_PATH}#${entry.slug}`;
      let html: string;
      try {
        html = renderToStaticMarkup(<Body components={rssComponents} />);
      } catch {
        // A single entry that references an unmapped component must not take
        // down the whole feed — fall back to a link into the page.
        html = `<p><a href="${link}">Read this update on docs.pyth.network</a></p>`;
      }
      const categories = [
        PRODUCT_LABELS[entry.product],
        TYPE_LABELS[entry.type],
        entry.area === undefined ? undefined : AREA_LABELS[entry.area],
      ]
        .filter((category) => category !== undefined)
        .map((category) => `<category>${escapeXml(category)}</category>`)
        .join("");
      const pubDate = new Date(`${entry.date}T00:00:00Z`).toUTCString();
      return [
        "<item>",
        `<title>${escapeXml(entry.title)}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="true">${link}</guid>`,
        `<pubDate>${pubDate}</pubDate>`,
        categories,
        `<content:encoded>${escapeXml(html)}</content:encoded>`,
        "</item>",
      ].join("");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${escapeXml(title)}</title>`,
    `<link>${SITE}${CHANGELOG_PATH}</link>`,
    `<atom:link href="${self}" rel="self" type="application/rss+xml"/>`,
    `<description>${escapeXml(description)}</description>`,
    `<lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    items,
    "</channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};
