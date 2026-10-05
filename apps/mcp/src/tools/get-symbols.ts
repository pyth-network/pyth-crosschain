import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import { HttpError } from "../clients/retry.js";
import type { Feed } from "../clients/types.js";
import type { Config } from "../config.js";
import { ASSET_TYPES, INSTRUMENT_TYPES } from "../constants.js";
import type { SessionContext } from "../server.js";
import {
  accessTokenSchema,
  resolveAccessToken,
} from "../utils/access-token.js";
import { authErrorFor, toolError } from "../utils/errors.js";
import { isActive, NOT_LIVE_STATES } from "../utils/feeds.js";
import {
  computeTokenHash,
  getApiKeyLast4,
  logToolCall,
} from "../utils/logger.js";
import { getServerTime } from "../utils/timestamp.js";

const ENTITLEMENTS_UNAVAILABLE_NOTE =
  "Could not load which feeds your access token is entitled to, so feeds have no `entitled` flag this time. The list itself is complete; try again shortly for the flags.";

const NOTHING_ENTITLED_NOTE =
  "Your access token is not entitled to any feed. It may be invalid or expired: the symbols API does not reject unknown tokens, so check the token, or call get_latest_price with it, which does.";

const PUBLIC_ONLY_NOTE =
  "Showing public feeds only. Pass `access_token` (or configure the key in your MCP client) to also see feeds visible only to Pyth Pro keys, plus an `entitled` flag on each feed.";

/** Why a feed is not entitled: not live, gated by a group, or unavailable. */
function notEntitledReason(feed: Feed): string {
  if (NOT_LIVE_STATES.has(feed.state)) return `not_live (${feed.state})`;
  if (feed.groups && feed.groups.length > 0) {
    return `requires one of entitlement groups: ${feed.groups.join(", ")}`;
  }
  return `not available to this key (state: ${feed.state})`;
}

const GetSymbolsInput = {
  access_token: accessTokenSchema(
    "Optional. The user's own Pyth Pro access token; omit it when the user configured one in their MCP client. With a token the list includes feeds visible only to Pro keys, and each feed gets an `entitled` flag.",
  ),
  asset_type: z
    .enum(ASSET_TYPES)
    .optional()
    .describe(`Filter by asset type: ${ASSET_TYPES.join(", ")}`),
  include_inactive: z
    .boolean()
    .default(false)
    .describe(
      "Include retired feeds (state 'inactive'). Default false: inactive feeds are hidden.",
    ),
  instrument_type: z
    .enum(INSTRUMENT_TYPES)
    .optional()
    .describe(`Filter by instrument type: ${INSTRUMENT_TYPES.join(", ")}`),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Results per page (default 50, max 200)"),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Pagination offset (default 0)"),
  query: z
    .string()
    .optional()
    .describe("Text filter (e.g. 'BTC', 'gold', 'AAPL')"),
  symbol_chain_id: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Filter futures by chain ID, exact and case-sensitive (e.g. 'VX' for all VIX futures contracts)",
    ),
  verbose: z
    .boolean()
    .default(false)
    .describe(
      "Return every catalog field (trading schedules, market_sessions, corporate_actions, hermes_id, ...). Default false: compact feeds, about 4x smaller.",
    ),
};

export function registerGetSymbols(
  server: McpServer,
  _config: Config,
  historyClient: HistoryClient,
  logger: Logger,
  sessionContext: SessionContext,
): void {
  server.registerTool(
    "get_symbols",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description:
        "List available Pyth Pro price feeds. Use this FIRST to discover what feeds exist before calling get_latest_price, get_historical_price, get_price_range or get_candlestick_data (those also accept bare pairs like BTC/USD). Filter by asset_type (e.g. crypto, equity, fx, metal, commodity, interest-rate, funding-rate, kalshi) or search by name/symbol. Narrow further with instrument_type (spot, future, ...) or symbol_chain_id (all contracts of one futures chain, e.g. VX). Retired (inactive) feeds are hidden unless include_inactive is true. Returns compact feed metadata: symbol, name, description, pyth_lazer_id, asset_type, instrument_type, state, exponent, min_channel (fastest channel the feed supports), quote_currency, and where set groups (entitlement groups that gate the feed), expiration_time and symbol_chain_id (futures). Pass verbose: true for every catalog field, e.g. market_sessions (trading-hours schedules) and corporate_actions (e.g. stock splits). With an access token, the list also includes feeds visible only to Pro keys, and each feed has `entitled`: true means this key can query the feed right now. When `entitled` is false, `not_entitled_reason` says why: `not_live (...)` means the feed is in beta, not live yet, or retired, so no key can query it (NOT a plan limitation), `requires one of entitlement groups: ...` means the user's plan lacks that entitlement.",
      inputSchema: GetSymbolsInput,
      title: "List Pyth Price Feeds",
    },
    async (params, extra) => {
      sessionContext.toolCallCount++;
      const start = Date.now();

      const auth = resolveAccessToken(
        params.access_token,
        sessionContext.clientAccessToken,
      );
      const token = auth.token;

      const baseMetrics = {
        apiKeyLast4: getApiKeyLast4(token),
        clientName: sessionContext.clientName,
        clientVersion: sessionContext.clientVersion,
        requestId: extra.requestId,
        sessionId: extra.sessionId ?? sessionContext.sessionId,
        tokenHash: computeTokenHash(token),
        tokenSource: auth.source,
        tool: "get_symbols" as const,
      };

      if (auth.error) {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "invalid_client_token",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(auth.error);
      }

      try {
        const [catalog, entitledResult] = await Promise.all([
          historyClient.getSymbols(token),
          token
            ? historyClient.getEntitledFeedIds(token).then(
                (value) => ({ ok: true as const, value }),
                (error: unknown) => ({ error, ok: false as const }),
              )
            : undefined,
        ]);
        const feeds = catalog.data;

        // Flags are optional; only an invalid token fails the listing.
        let entitled:
          | Awaited<ReturnType<HistoryClient["getEntitledFeedIds"]>>
          | undefined;
        let note = token ? undefined : PUBLIC_ONLY_NOTE;
        if (entitledResult?.ok === false) {
          const err = entitledResult.error;
          if (err instanceof HttpError && err.status === 401) throw err;
          logger.warn({ err }, "get_symbols: entitlement list unavailable");
          note = ENTITLEMENTS_UNAVAILABLE_NOTE;
        } else if (entitledResult?.ok) {
          entitled = entitledResult.value;
          // The symbols API accepts unknown tokens; an empty list is the only sign.
          if (entitled.data.size === 0) note = NOTHING_ENTITLED_NOTE;
        }
        const upstreamLatencyMs = Math.max(
          catalog.upstreamLatencyMs,
          entitled?.upstreamLatencyMs ?? 0,
        );

        let filtered = params.include_inactive ? feeds : feeds.filter(isActive);
        if (params.asset_type) {
          filtered = filtered.filter((f) => f.asset_type === params.asset_type);
        }
        if (params.instrument_type) {
          filtered = filtered.filter(
            (f) => f.instrument_type === params.instrument_type,
          );
        }
        if (params.symbol_chain_id) {
          filtered = filtered.filter(
            (f) => f.symbol_chain_id === params.symbol_chain_id,
          );
        }
        const q = params.query?.trim().toLowerCase();
        if (q) {
          filtered = filtered.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              f.symbol.toLowerCase().includes(q) ||
              f.description.toLowerCase().includes(q),
          );
        }

        const totalAvailable = filtered.length;
        const offset = params.offset;
        const limit = params.limit;
        const page = filtered.slice(offset, offset + limit).map((f) => ({
          ...(params.verbose ? f : compactFeed(f)),
          ...entitlementFields(f, entitled?.data),
        }));
        const hasMore = offset + limit < totalAvailable;

        const result = {
          count: page.length,
          feeds: page,
          has_more: hasMore,
          next_offset: hasMore ? offset + limit : null,
          ...(note ? { note } : {}),
          offset,
          total_available: totalAvailable,
          ...getServerTime(),
        };

        const responseText = JSON.stringify(result);

        logToolCall(logger, {
          ...baseMetrics,
          latencyMs: Date.now() - start,
          numFeedsReturned: page.length,
          responseSizeBytes: Buffer.byteLength(responseText),
          status: "success",
          upstreamLatencyMs,
        });
        return {
          content: [{ text: responseText, type: "text" as const }],
        };
      } catch (err) {
        const authError = authErrorFor(err);
        if (!authError) logger.warn({ err }, "get_symbols upstream error");
        logToolCall(logger, {
          ...baseMetrics,
          errorType: authError?.errorType ?? "upstream",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(
          authError?.message ?? "Failed to fetch symbols. Please try again.",
        );
      }
    },
  );
}

function entitlementFields(
  feed: Feed,
  entitledIds: ReadonlySet<number> | undefined,
): { entitled?: boolean; not_entitled_reason?: string } {
  if (!entitledIds) return {};
  if (entitledIds.has(feed.pyth_lazer_id)) return { entitled: true };
  return { entitled: false, not_entitled_reason: notEntitledReason(feed) };
}

/** Fields needed to pick and query a feed; `verbose` returns everything. */
function compactFeed(feed: Feed) {
  return {
    asset_type: feed.asset_type,
    description: feed.description,
    exponent: feed.exponent,
    instrument_type: feed.instrument_type,
    min_channel: feed.min_channel,
    name: feed.name,
    pyth_lazer_id: feed.pyth_lazer_id,
    quote_currency: feed.quote_currency,
    state: feed.state,
    symbol: feed.symbol,
    // Only where they carry information (futures, gated feeds).
    ...(feed.expiration_time ? { expiration_time: feed.expiration_time } : {}),
    ...((feed.groups?.length ?? 0) > 0 ? { groups: feed.groups } : {}),
    ...(feed.symbol_chain_id ? { symbol_chain_id: feed.symbol_chain_id } : {}),
  };
}
