import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

import {
  AREA_LABELS,
  CHANGELOG_PATH,
  CHANGELOG_PRODUCTS,
  CHANGELOG_TYPES,
  feedUrl,
  PRODUCT_LABELS,
  parseProductParam,
  parseTypeParam,
  SITE,
  TYPE_LABELS,
} from "../../../lib/changelog";
import { getChangelogEntries } from "../../../lib/changelog-data";
import type { RssItem } from "./feed";
import { buildFeedXml } from "./feed";

const ALL_PRODUCTS = "across Pyth Pro, Pyth Core, and Entropy";

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

// RSS 2.0 feed for the cross-product changelog. `/changelog/feed.xml` covers
// everything; `?product=pyth-pro|pyth-core|entropy` and
// `?type=feature|fix|breaking-change|deprecation|docs` narrow it, and combine
// — this is what the Subscribe menu links to. Serialization lives in ./feed;
// this handler only validates the params, renders bodies, and assembles items.
export const GET = async (request: Request): Promise<Response> => {
  // Loaded dynamically: Next.js rejects a static `react-dom/server` import
  // anywhere in the app module graph, but a route handler is a plain Node
  // function — rendering entry bodies to HTML strings here is exactly what
  // renderToStaticMarkup is for.
  const { renderToStaticMarkup } = await import("react-dom/server");

  const params = new URL(request.url).searchParams;
  const parsedProduct = parseProductParam(params.get("product"));
  if (!parsedProduct.ok) {
    return new Response(
      `Unknown product "${parsedProduct.value}". Expected one of: ${CHANGELOG_PRODUCTS.join(", ")}.`,
      { headers: { "Content-Type": "text/plain" }, status: 400 },
    );
  }
  const parsedType = parseTypeParam(params.get("type"));
  if (!parsedType.ok) {
    return new Response(
      `Unknown type "${parsedType.value}". Expected one of: ${CHANGELOG_TYPES.join(", ")}.`,
      { headers: { "Content-Type": "text/plain" }, status: 400 },
    );
  }
  const product = parsedProduct.value;
  const type = parsedType.value;

  const entries = getChangelogEntries().filter(
    (entry) =>
      (product === null || entry.product === product) &&
      (type === null || entry.type === type),
  );

  const latest = entries[0]?.date;
  const kind = type === null ? "Product updates" : `${TYPE_LABELS[type]} updates`;
  const scope =
    product === null ? ALL_PRODUCTS : `for ${PRODUCT_LABELS[product]}`;
  const narrowing = [
    product === null ? undefined : PRODUCT_LABELS[product],
    type === null ? undefined : TYPE_LABELS[type],
  ].filter((label) => label !== undefined);
  const channel = {
    description: `${kind} ${scope}.`,
    lastBuildDate: latest
      ? new Date(`${latest}T00:00:00Z`).toUTCString()
      : new Date().toUTCString(),
    link: `${SITE}${CHANGELOG_PATH}`,
    self: `${SITE}${feedUrl({ product: product ?? undefined, type: type ?? undefined })}`,
    title:
      narrowing.length === 0
        ? "Pyth Changelog"
        : `Pyth Changelog — ${narrowing.join(", ")}`,
  };

  const items: RssItem[] = entries.map((entry) => {
    const Body = entry.body;
    const link = `${SITE}${CHANGELOG_PATH}#${entry.slug}`;
    let contentHtml: string;
    try {
      contentHtml = renderToStaticMarkup(<Body components={rssComponents} />);
    } catch {
      // A single entry that references an unmapped component must not take
      // down the whole feed — fall back to a link into the page.
      contentHtml = `<p><a href="${link}">Read this update on docs.pyth.network</a></p>`;
    }
    return {
      categories: [
        PRODUCT_LABELS[entry.product],
        TYPE_LABELS[entry.type],
        entry.area === undefined ? undefined : AREA_LABELS[entry.area],
      ].filter((category) => category !== undefined),
      contentHtml,
      link,
      pubDate: new Date(`${entry.date}T00:00:00Z`).toUTCString(),
      title: entry.title,
    };
  });

  return new Response(buildFeedXml(channel, items), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};
