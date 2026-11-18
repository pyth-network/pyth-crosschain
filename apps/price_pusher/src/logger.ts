import type { DestinationStream, Logger } from "pino";
import { pino } from "pino";

export const REDACTED = "[REDACTED]";

// URL path segments and query values shorter than this are kept, so that
// common words such as `v2`, `rpc` or `mainnet` stay readable in the logs.
// RPC providers' tokens (Alchemy, Infura, QuickNode, Ankr, ...) are all
// longer than this.
const MIN_URL_SECRET_LENGTH = 12;

/**
 * Collect the parts of a configured value that may hold a credential.
 *
 * - For a URL: the userinfo, the long path segments, and the long query
 *   values. RPC providers put API keys in any of these places.
 * - For a `key=value` header (e.g. Sui `--grpc-metadata`): the value.
 * - For anything else (e.g. a bearer token): the whole string.
 */
export function extractSecrets(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed === "") {
    return [];
  }

  let url: URL | undefined;
  try {
    url = new URL(trimmed);
  } catch {
    url = undefined;
  }

  if (url?.host) {
    const secrets: string[] = [];
    if (url.username !== "") {
      secrets.push(url.username, decodeURIComponent(url.username));
    }
    if (url.password !== "") {
      secrets.push(url.password, decodeURIComponent(url.password));
    }
    for (const segment of url.pathname.split("/")) {
      if (segment.length >= MIN_URL_SECRET_LENGTH) {
        secrets.push(segment, decodeURIComponent(segment));
      }
    }
    for (const [, paramValue] of url.searchParams) {
      if (paramValue.length >= MIN_URL_SECRET_LENGTH) {
        secrets.push(paramValue, encodeURIComponent(paramValue));
      }
    }
    return secrets;
  }

  const eq = trimmed.indexOf("=");
  if (eq !== -1) {
    const headerValue = trimmed.slice(eq + 1);
    return headerValue === "" ? [] : [headerValue];
  }

  return [trimmed];
}

/**
 * Build a function that replaces every secret found in `sources` with
 * `[REDACTED]`. Sources may be URLs, `key=value` headers or raw tokens;
 * `undefined` and empty entries are ignored.
 */
export function createRedactor(
  sources: (string | undefined)[],
): (line: string) => string {
  const secrets = [
    ...new Set(
      sources
        .filter((source): source is string => typeof source === "string")
        .flatMap((source) => extractSecrets(source))
        .filter((secret) => secret !== ""),
    ),
  ]
    // Replace longer secrets first so a secret that contains another one is
    // removed whole.
    .sort((a, b) => b.length - a.length);

  if (secrets.length === 0) {
    return (line) => line;
  }

  return (line) => {
    let result = line;
    for (const secret of secrets) {
      result = result.replaceAll(secret, REDACTED);
    }
    return result;
  };
}

// The redactor of the last logger built by `createLogger`. The CLI uses it to
// scrub errors that escape a command handler, since yargs prints those
// directly to stderr instead of through the logger.
let activeRedactor: (line: string) => string = (line) => line;

/** Remove the secrets known to the active logger from `text`. */
export function redactSecrets(text: string): string {
  return activeRedactor(text);
}

/**
 * Create the pusher's root logger. Every line it (and its children) writes is
 * scrubbed of the secrets found in `secretSources`, such as API keys embedded
 * in RPC endpoint URLs. Libraries like viem put the full request URL in their
 * error messages, so the error logs would otherwise leak these keys.
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
