import type { Logger } from "pino";
import type { HistoryClient } from "../clients/history.js";
import type { Feed } from "../clients/types.js";
import type { SessionContext } from "../server.js";
import { resolveAccessToken } from "../utils/access-token.js";
import {
  authErrorFor,
  ErrorMessages,
  rejectionErrorFor,
  toolError,
} from "../utils/errors.js";
import {
  computeTokenHash,
  getApiKeyLast4,
  logToolCall,
} from "../utils/logger.js";
import { resolveSymbols, tryGetCatalog } from "../utils/resolve-symbols.js";
import { getServerTime } from "../utils/timestamp.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
};

type RequestExtra = { requestId: string | number; sessionId?: string };

export type PriceToolContext = {
  token: string;
  /** Feeds sent upstream, after deduplication; logged with the call. */
  setFeedsRequested(count: number): void;
  /** Log the call as failed and return `message` as a tool error. */
  fail(
    errorType: string,
    message: string,
    upstreamLatencyMs?: number,
  ): ToolResult;
  /** Log the call as successful and return `payload` (plus server time). */
  succeed(
    payload: Record<string, unknown>,
    metrics: { numFeedsReturned: number; upstreamLatencyMs: number },
  ): ToolResult;
};

export type PriceToolOptions = {
  tool: string;
  logger: Logger;
  sessionContext: SessionContext;
  /** Appended to Pyth's 400/404 reason; a function runs at error time. */
  rejectionHint: string | (() => string);
  /** Returned for any other upstream failure. */
  failureMessage: string;
};

/** A required catalog failed (not auth); reported as `failureMessage`. */
class CatalogUnavailableError extends Error {
  constructor(cause: unknown) {
    super("symbol catalog unavailable", { cause });
  }
}

/** Shared shell of the price tools: metrics, token check, error mapping. */
export async function runPriceTool(
  options: PriceToolOptions,
  /** `access_token` from the call; falls back to the client-configured key. */
  accessToken: string | undefined,
  extra: RequestExtra,
  run: (ctx: PriceToolContext) => Promise<ToolResult>,
): Promise<ToolResult> {
  const { logger, sessionContext, tool } = options;
  sessionContext.toolCallCount++;
  const start = Date.now();
  const auth = resolveAccessToken(
    accessToken,
    sessionContext.clientAccessToken,
  );

  const baseMetrics = {
    apiKeyLast4: getApiKeyLast4(auth.token),
    clientName: sessionContext.clientName,
    clientVersion: sessionContext.clientVersion,
    numFeedsRequested: undefined as number | undefined,
    requestId: extra.requestId,
    sessionId: extra.sessionId ?? sessionContext.sessionId,
    tokenHash: computeTokenHash(auth.token),
    tokenSource: auth.source,
    tool,
  };

  const fail = (
    errorType: string,
    message: string,
    upstreamLatencyMs?: number,
  ): ToolResult => {
    logToolCall(logger, {
      ...baseMetrics,
      errorType,
      latencyMs: Date.now() - start,
      status: "error",
      upstreamLatencyMs,
    });
    return toolError(message);
  };

  if (auth.error) return fail("invalid_client_token", auth.error);
  if (!auth.token) return fail("missing_token", ErrorMessages.MISSING_TOKEN);
  const token = auth.token;

  const ctx: PriceToolContext = {
    fail,
    setFeedsRequested(count) {
      baseMetrics.numFeedsRequested = count;
    },
    succeed(payload, metrics) {
      const text = JSON.stringify({ ...payload, ...getServerTime() });
      logToolCall(logger, {
        ...baseMetrics,
        latencyMs: Date.now() - start,
        numFeedsReturned: metrics.numFeedsReturned,
        responseSizeBytes: Buffer.byteLength(text),
        status: "success",
        upstreamLatencyMs: metrics.upstreamLatencyMs,
      });
      return { content: [{ text, type: "text" as const }] };
    },
    token,
  };

  try {
    return await run(ctx);
  } catch (err) {
    if (!(err instanceof CatalogUnavailableError)) {
      const authError = authErrorFor(err);
      if (authError) return fail(authError.errorType, authError.message);

      const hint =
        typeof options.rejectionHint === "function"
          ? options.rejectionHint()
          : options.rejectionHint;
      const rejection = rejectionErrorFor(err, hint);
      if (rejection) return fail(rejection.errorType, rejection.message);
    }

    logger.warn(
      { err: err instanceof CatalogUnavailableError ? err.cause : err },
      `${tool} upstream error`,
    );
    return fail("upstream", options.failureMessage);
  }
}

export type FeedInputs =
  | {
      ok: true;
      /** Deduplicated feed IDs to request; empty when `unresolvedSymbols` is set. */
      ids: number[];
      /** One feed per symbol input, in order (empty for ID input). */
      feeds: Feed[];
      /** Inputs that resolved to a different symbol, e.g. BTC/USD -> Crypto.BTC/USD. */
      resolvedSymbols: Record<string, string>;
      /** Set when the catalog was unavailable: send these symbols as given. */
      unresolvedSymbols?: string[];
      upstreamLatencyMs: number;
    }
  | { ok: false; errorType: "not_found" | "validation"; message: string };

/**
 * `price_feed_ids` (preferred) or `symbols` -> feed IDs. Without the catalog,
 * "required" fails, "optional" passes symbols through, and "optional-router"
 * also passes through a History 403.
 */
export async function resolveFeedInputs(options: {
  historyClient: HistoryClient;
  logger: Logger;
  token: string;
  priceFeedIds?: number[];
  symbols?: string[];
  catalog: "required" | "optional" | "optional-router";
}): Promise<FeedInputs> {
  const ids = options.priceFeedIds ?? [];
  if (ids.length > 0) {
    return {
      feeds: [],
      ids: [...new Set(ids)],
      ok: true,
      resolvedSymbols: {},
      upstreamLatencyMs: 0,
    };
  }

  const symbols = options.symbols ?? [];
  if (symbols.length === 0) {
    return {
      errorType: "validation",
      message: "At least one of 'price_feed_ids' or 'symbols' is required",
      ok: false,
    };
  }

  const catalog =
    options.catalog === "required"
      ? await loadRequiredCatalog(options.historyClient, options.token)
      : await tryGetCatalog(
          options.historyClient,
          options.token,
          options.logger,
          {
            priceFromRouter: options.catalog === "optional-router",
          },
        );
  if (!catalog) {
    return {
      feeds: [],
      ids: [],
      ok: true,
      resolvedSymbols: {},
      unresolvedSymbols: symbols,
      upstreamLatencyMs: 0,
    };
  }

  const resolution = resolveSymbols(symbols, catalog.data);
  if (resolution.errors.length > 0) {
    return {
      errorType: "not_found",
      message: resolution.errors.join("\n"),
      ok: false,
    };
  }
  return {
    feeds: resolution.feeds,
    ids: [...new Set(resolution.feeds.map((f) => f.pyth_lazer_id))],
    ok: true,
    resolvedSymbols: resolution.resolved,
    upstreamLatencyMs: catalog.upstreamLatencyMs,
  };
}

async function loadRequiredCatalog(
  historyClient: HistoryClient,
  token: string,
) {
  try {
    return await historyClient.getSymbols(token);
  } catch (err) {
    // Auth errors keep their meaning; anything else is "catalog unavailable".
    if (authErrorFor(err)) throw err;
    throw new CatalogUnavailableError(err);
  }
}
