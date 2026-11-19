import type { DestinationStream, Logger } from "pino";
import { pino } from "pino";

export const REDACTED = "<token>";

// RPC provider keys (Alchemy, QuickNode, Ankr, ...) are all longer than this.
// Shorter values, such as `v2` or `evm`, stay readable.
const MAX_PLAIN_LENGTH = 30;

const X_TOKEN_PREFIX = "x-token=";

function isSecret(value: string): boolean {
  return value.length > MAX_PLAIN_LENGTH;
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/**
 * Collect the parts of a configured value that may be a secret:
 *
 * - `x-token=<token>` (Sui `--grpc-metadata`): the token.
 * - A URL: each path segment.
 * - Anything else (e.g. the Hermes access token): the whole value.
 */
function secretCandidates(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith(X_TOKEN_PREFIX)) {
    return [trimmed.slice(X_TOKEN_PREFIX.length)];
  }
  const url = parseUrl(trimmed);
  if (url?.host) {
    return url.pathname.split("/");
  }
  return [trimmed];
}

/**
 * Build a function that replaces with `<token>` every candidate from
 * `secretCandidates` that is longer than 30 characters. `undefined` entries
 * are ignored.
 */
export function createRedactor(
  sources: (string | undefined)[],
): (line: string) => string {
  const secrets = [
    ...new Set(
      sources
        .filter((source): source is string => typeof source === "string")
        .flatMap((source) => secretCandidates(source))
        .filter(isSecret),
    ),
  ]
    // Replace longer secrets first, so a secret that contains another one is
    // replaced whole.
    .sort((a, b) => b.length - a.length);
  return (line) =>
    secrets.reduce(
      (result, secret) => result.replaceAll(secret, REDACTED),
      line,
    );
}

/**
 * Create the pusher's root logger. Every line it (and its children) writes has
 * the secrets found in `secretSources` replaced with `<token>`. Libraries like
 * viem put the full request URL in their error messages.
 */
export function createLogger(
  level: string,
  secretSources: (string | undefined)[],
  destination?: DestinationStream,
): Logger {
  const redact = createRedactor(secretSources);
  const options = { hooks: { streamWrite: redact }, level };
  return destination === undefined ? pino(options) : pino(options, destination);
}
