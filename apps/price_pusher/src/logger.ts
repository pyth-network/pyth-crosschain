import type { DestinationStream, Logger } from "pino";
import { pino } from "pino";

export const REDACTED = "<token>";

// RPC provider keys (Alchemy, QuickNode, Ankr, ...) are all longer than this.
// Shorter values, such as `v2` or `evm`, stay readable.
const MAX_PLAIN_LENGTH = 30;

const X_TOKEN_PREFIX = "x-token=";

/**
 * Collect the secrets in a configured value:
 *
 * - `x-token=<token>` (Sui `--grpc-metadata`): the token.
 * - A URL: each path segment longer than 30 characters.
 * - Anything else (e.g. the Hermes access token): the whole value, if it is
 *   longer than 30 characters.
 */
export function extractSecrets(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith(X_TOKEN_PREFIX)) {
    const token = trimmed.slice(X_TOKEN_PREFIX.length);
    return token === "" ? [] : [token];
  }

  let url: URL | undefined;
  try {
    url = new URL(trimmed);
  } catch {
    url = undefined;
  }
  if (url?.host) {
    return url.pathname
      .split("/")
      .filter((segment) => segment.length > MAX_PLAIN_LENGTH);
  }

  return trimmed.length > MAX_PLAIN_LENGTH ? [trimmed] : [];
}

/**
 * Build a function that replaces every secret found in `sources` with
 * `<token>`. `undefined` entries are ignored.
 */
export function createRedactor(
  sources: (string | undefined)[],
): (line: string) => string {
  const secrets = [
    ...new Set(
      sources
        .filter((source): source is string => typeof source === "string")
        .flatMap((source) => extractSecrets(source)),
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

// The redactor of the last logger built by `createLogger`. The CLI uses it to
// scrub errors that escape a command handler.
let activeRedactor: (line: string) => string = (line) => line;

/** Remove the secrets known to the active logger from `text`. */
export function redactSecrets(text: string): string {
  return activeRedactor(text);
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
  activeRedactor = redact;
  const options = { hooks: { streamWrite: redact }, level };
  return destination === undefined ? pino(options) : pino(options, destination);
}
