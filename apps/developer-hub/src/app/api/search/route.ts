import type { AdvancedIndex, SortedResult } from "fumadocs-core/search/server";
import {
  createContentHighlighter,
  initAdvancedSearch,
} from "fumadocs-core/search/server";
import priceFeeds from "../../../generated/price-feeds.json";
import { source } from "../../../lib/source";
import type { HermesFeed, LazerFeed, PriceFeedsSnapshot } from "./feed-schemas";

// Feed lists are fetched at build time by
// `scripts/generate-price-feeds-snapshot.ts` and imported statically here, so
// the search route performs zero external HTTP calls at runtime.
const snapshot = priceFeeds as PriceFeedsSnapshot;

const CORE_FEED_PATH = "/price-feeds/core/price-feeds/price-feed-ids";
const PRO_FEED_PATH = "/price-feeds/pro/price-feed-ids";

// Total results handed back to the search dialog. Without a cap, a query like
// "USD" matches most of the indexed documents and the route serialises several
// MB on every debounce tick.
const MAX_RESULTS = 24;
// Reserved slots per family, so no family can crowd out another: "USD" matches
// nearly every Core feed and used to push the first documentation hit to rank
// 624, while "solana" is dominated by docs and would otherwise surface no feeds
// at all. Whatever a family does not claim is backfilled from the rest, so a
// query with no feed matches still returns a full page of docs.
const MAX_DOC_RESULTS = 12;
const MAX_CORE_FEED_RESULTS = 6;
const MAX_PRO_FEED_RESULTS = 6;

// fumadocs indexes `title` and `description` as their own documents, so the
// per-field `structuredData.contents` entries feeds used to carry only
// duplicated text already covered by those two fields, at 2-3x the document
// count. Symbol, name, description and feed ID all remain searchable.
const NO_STRUCTURED_DATA = { contents: [], headings: [] };

function hermesToAdvancedIndex(fee: HermesFeed): AdvancedIndex {
  return {
    description: `Price Feed ID: ${fee.id}`,
    id: fee.id,
    structuredData: NO_STRUCTURED_DATA,
    tag: "price-feed-core",
    title: `${fee.attributes.symbol} (Core)`,
    url: `${CORE_FEED_PATH}?search=${fee.attributes.symbol}`,
  };
}

function lazerToAdvancedIndex(feed: LazerFeed): AdvancedIndex {
  return {
    description: `${feed.symbol} - ${feed.description} (ID: ${String(feed.pyth_lazer_id)})`,
    id: `lazer-${String(feed.pyth_lazer_id)}`,
    structuredData: NO_STRUCTURED_DATA,
    tag: "price-feed-pro",
    title: `${feed.name} (Pro)`,
    url: `${PRO_FEED_PATH}?search=${feed.symbol}`,
  };
}

/**
 * Core feeds from mainnet and beta, deduplicated by symbol.
 *
 * hermes-beta republishes 99.4% of the mainnet symbol list (2,873 of 2,890),
 * and both sides render to the same `SYMBOL (Core)` title pointing at the same
 * `?search=SYMBOL` URL, so indexing both put literal duplicate rows in the
 * search dialog and doubled the Core half of the index for nothing. Mainnet
 * wins ties; the handful of beta-only symbols stay searchable.
 */
function coreFeeds(): HermesFeed[] {
  const bySymbol = new Map<string, HermesFeed>();
  for (const feed of snapshot.hermesBeta) {
    bySymbol.set(feed.attributes.symbol, feed);
  }
  for (const feed of snapshot.hermes) {
    bySymbol.set(feed.attributes.symbol, feed);
  }
  return [...bySymbol.values()];
}

type Family = "core" | "docs" | "pro";

// Feed symbols are dotted/slashed paths ("Crypto.BTC/USD", "Equity.US.RIVN/USD.ON").
const SYMBOL_SEPARATORS = /[./]/;

const tokenize = (value: string): string[] =>
  value.toLowerCase().split(SYMBOL_SEPARATORS).filter(Boolean);

/**
 * A feed as seen by the exact-match pass.
 *
 * Orama ranks with BM25 over ~13k documents, which does not favour the feed a
 * user actually typed: searching the exact symbol "Crypto.BTC/USD" returned 24
 * results without that feed among them, because common tokens ("crypto",
 * "usd") score highly across thousands of near-identical symbols. This pass
 * guarantees the obvious answer is present before Orama fills the rest.
 */
type FeedCandidate = {
  family: Exclude<Family, "docs">;
  index: AdvancedIndex;
  name: string;
  symbol: string;
  tokens: Set<string>;
};

function toCandidate(
  family: Exclude<Family, "docs">,
  symbol: string,
  name: string,
  index: AdvancedIndex,
): FeedCandidate {
  return {
    family,
    index,
    name: name.toLowerCase(),
    symbol: symbol.toLowerCase(),
    tokens: new Set([...tokenize(symbol), ...tokenize(name)]),
  };
}

const CORE_INDEXES = coreFeeds().map((feed) => ({
  feed,
  index: hermesToAdvancedIndex(feed),
}));
const PRO_INDEXES = snapshot.lazer.map((feed) => ({
  feed,
  index: lazerToAdvancedIndex(feed),
}));

const FEED_CANDIDATES: FeedCandidate[] = [
  ...CORE_INDEXES.map(({ feed, index }) =>
    toCandidate("core", feed.attributes.symbol, feed.attributes.symbol, index),
  ),
  ...PRO_INDEXES.map(({ feed, index }) =>
    toCandidate("pro", feed.symbol, feed.name, index),
  ),
];

/**
 * Score a feed against the query. 2 = the whole symbol or name was typed,
 * 1 = every token in the query appears in the feed, 0 = no direct match.
 *
 * The token rule keeps "ETH/USD" on Crypto.ETH/USD without dragging in
 * Crypto.ETH/USDT, and leaves vague one-character queries to Orama.
 */
function scoreCandidate(
  candidate: FeedCandidate,
  query: string,
  queryTokens: string[],
): number {
  if (candidate.symbol === query || candidate.name === query) return 2;
  return queryTokens.every((token) => candidate.tokens.has(token)) ? 1 : 0;
}

function directFeedMatches(query: string): AdvancedIndex[] {
  const normalized = query.trim().toLowerCase();
  const queryTokens = tokenize(normalized);
  if (queryTokens.length === 0) return [];

  const scored: { candidate: FeedCandidate; score: number }[] = [];
  for (const candidate of FEED_CANDIDATES) {
    const score = scoreCandidate(candidate, normalized, queryTokens);
    if (score > 0) scored.push({ candidate, score });
  }

  // Best match first, then the most canonical symbol: "Crypto.BTC/USD" should
  // outrank "FundingRate.Binance.BTC/USDT" for the query "BTC".
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.candidate.symbol.length - b.candidate.symbol.length,
  );

  const taken: AdvancedIndex[] = [];
  const used = { core: 0, pro: 0 };
  const limits = { core: MAX_CORE_FEED_RESULTS, pro: MAX_PRO_FEED_RESULTS };
  for (const { candidate } of scored) {
    if (used[candidate.family] >= limits[candidate.family]) continue;
    used[candidate.family] += 1;
    taken.push(candidate.index);
    if (used.core >= limits.core && used.pro >= limits.pro) break;
  }
  return taken;
}

const server = initAdvancedSearch({
  indexes: () => {
    const staticPages = source.getPages().map((page) => ({
      description: page.data.description,
      id: page.url,
      structuredData: page.data.structuredData,
      title: page.data.title,
      url: page.url,
    })) as AdvancedIndex[];

    return [
      ...staticPages,
      ...CORE_INDEXES.map(({ index }) => index),
      ...PRO_INDEXES.map(({ index }) => index),
    ];
  },
});

const QUOTAS: Record<Family, number> = {
  core: MAX_CORE_FEED_RESULTS,
  docs: MAX_DOC_RESULTS,
  pro: MAX_PRO_FEED_RESULTS,
};

function familyOf(result: SortedResult): Family {
  if (result.url.startsWith(CORE_FEED_PATH)) return "core";
  if (result.url.startsWith(PRO_FEED_PATH)) return "pro";
  return "docs";
}

/**
 * Trim the full match set to `MAX_RESULTS`, giving each family its reserved
 * slots first and then backfilling any unused slots with the next
 * highest-ranked results so a docs-only or feed-only query still fills the list.
 */
function applyQuotas(results: SortedResult[]): SortedResult[] {
  const picked: SortedResult[] = [];
  const overflow: SortedResult[] = [];
  const used: Record<Family, number> = { core: 0, docs: 0, pro: 0 };

  for (const result of results) {
    if (picked.length >= MAX_RESULTS) break;
    const family = familyOf(result);
    if (used[family] < QUOTAS[family]) {
      used[family] += 1;
      picked.push(result);
    } else if (overflow.length < MAX_RESULTS) {
      overflow.push(result);
    }
  }

  return [...picked, ...overflow].slice(0, MAX_RESULTS);
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = params.get("query");

  if (!query) return Response.json([]);

  const tag = params.get("tag");
  const locale = params.get("locale");

  const highlighter = createContentHighlighter(query);
  const exact: SortedResult[] = directFeedMatches(query).map((index) => ({
    content: index.title,
    contentWithHighlights: highlighter.highlight(index.title),
    id: index.id,
    type: "page",
    url: index.url,
  }));

  const results = await server.search(query, {
    ...(tag === null ? {} : { tag: tag.split(",") }),
    ...(locale === null ? {} : { locale }),
  });

  // A feed surfaced by the exact-match pass must not appear again as an Orama
  // page row or as one of its own description snippets; both share the feed URL.
  const seen = new Set(exact.map((result) => result.url));

  return Response.json(
    applyQuotas([...exact, ...results.filter((r) => !seen.has(r.url))]),
  );
}
