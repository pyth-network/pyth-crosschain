import type { Feed } from "../clients/types.js";

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
 * Resolve user-supplied symbols to feeds. Accepts full symbols
 * ("Crypto.BTC/USD"), any casing, and bare pairs ("BTC/USD"):
 *
 * 1. Exact symbol match.
 * 2. Case-insensitive symbol match.
 * 3. Bare pair: feeds whose symbol ends with "." + input. Inactive feeds are
 *    dropped, live feeds are preferred over coming_soon, then spot feeds over
 *    other instruments. Resolves only when exactly one candidate is left;
 *    otherwise the error lists the candidates so the caller can pick one.
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

/** Narrow to the matching subset when it is non-empty. */
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
