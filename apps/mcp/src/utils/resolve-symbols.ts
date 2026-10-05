import type { Logger } from "pino";
import type { HistoryClient } from "../clients/history.js";
import { HttpError } from "../clients/retry.js";
import type { UpstreamResult } from "../clients/router.js";
import type { Feed } from "../clients/types.js";
import { authErrorFor } from "./errors.js";

const MAX_LISTED_CANDIDATES = 8;

export type SymbolResolution = {
  /** One feed per input, in input order (only when `errors` is empty). */
  feeds: Feed[];
  /** Inputs that resolved to a different full symbol, e.g. BTC/USD -> Crypto.BTC/USD. */
  resolved: Record<string, string>;
  /** One message per input that could not be resolved. */
  errors: string[];
};

/**
 * Exact, then case-insensitive, then bare pair (BTC/USD). Bare pairs drop
 * inactive feeds and prefer stable > beta > coming_soon, then spot.
 */
export function resolveSymbols(
  inputs: readonly string[],
  catalog: readonly Feed[],
): SymbolResolution {
  const feeds: Feed[] = [];
  const resolved: Record<string, string> = {};
  const errors: string[] = [];

  for (const input of inputs) {
    const result = resolveOne(input.trim(), catalog);
    if (typeof result === "string") {
      errors.push(result);
      continue;
    }
    feeds.push(result);
    if (result.symbol !== input) resolved[input] = result.symbol;
  }

  return { errors, feeds, resolved };
}

function resolveOne(input: string, catalog: readonly Feed[]): Feed | string {
  const exact = catalog.find((f) => f.symbol === input);
  if (exact) return exact;

  const lower = input.toLowerCase();
  const caseInsensitive = catalog.filter(
    (f) => f.symbol.toLowerCase() === lower,
  );
  if (caseInsensitive.length === 1 && caseInsensitive[0]) {
    return caseInsensitive[0];
  }

  const suffix = `.${lower}`;
  const matches = catalog.filter((f) =>
    f.symbol.toLowerCase().endsWith(suffix),
  );
  let candidates = matches.filter((f) => f.state !== "inactive");
  candidates = preferSubset(candidates, (f) => f.state === "stable");
  candidates = preferSubset(candidates, (f) => f.state !== "coming_soon");
  candidates = preferSubset(candidates, (f) => f.instrument_type === "spot");

  if (candidates.length === 1 && candidates[0]) return candidates[0];
  if (candidates.length === 0 && matches.length > 0) {
    const retired = matches.map((f) => f.symbol).join(", ");
    return `${input} only matches retired (inactive) feeds: ${retired}. Pass the full symbol to query one anyway.`;
  }
  if (candidates.length === 0) {
    return `Feed not found: ${input}. Use get_symbols to discover available feeds.`;
  }
  const listed = candidates
    .slice(0, MAX_LISTED_CANDIDATES)
    .map((f) => f.symbol)
    .join(", ");
  const more =
    candidates.length > MAX_LISTED_CANDIDATES
      ? ` and ${candidates.length - MAX_LISTED_CANDIDATES} more`
      : "";
  return `Ambiguous symbol: ${input} matches ${listed}${more}. Pass the full symbol.`;
}

function preferSubset(feeds: Feed[], keep: (f: Feed) => boolean): Feed[] {
  const subset = feeds.filter(keep);
  return subset.length > 0 ? subset : feeds;
}

/** Response field showing how bare inputs were resolved; omitted when none were. */
export function resolvedSymbolsField(resolved: Record<string, string>): {
  resolved_symbols?: Record<string, string>;
} {
  return Object.keys(resolved).length > 0 ? { resolved_symbols: resolved } : {};
}

/**
 * The catalog, or undefined if History is unavailable. Rethrows 401, and
 * 403 unless `priceFromRouter`.
 */
export async function tryGetCatalog(
  historyClient: HistoryClient,
  token: string | undefined,
  logger: Logger,
  options: { priceFromRouter?: boolean } = {},
): Promise<UpstreamResult<Feed[]> | undefined> {
  try {
    return await historyClient.getSymbols(token);
  } catch (err) {
    const authError = authErrorFor(err);
    const passThrough =
      options.priceFromRouter && err instanceof HttpError && err.status === 403;
    if (authError && !passThrough) throw err;
    logger.warn(
      { err },
      "symbol catalog unavailable; passing symbols through unresolved",
    );
    return undefined;
  }
}
