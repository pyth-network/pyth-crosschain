import type { DestinationStream, Logger } from "pino";
import { pino } from "pino";

export const REDACTED = "[REDACTED]";

// URL path segments and query values shorter than this are kept, so that
// common words such as `v2`, `rpc` or `mainnet` stay readable in the logs.
// RPC providers' tokens (Alchemy, Infura, QuickNode, Ankr, ...) are all
// longer than this.
const MIN_URL_SECRET_LENGTH = 12;

// Credentials without a natural boundary (URL userinfo, header values) shorter
// than this are kept. The redactor runs on the serialized JSON line, so a
// short secret such as `30` would rewrite `"level":30` and break the JSON.
const MIN_SECRET_LENGTH = 6;

// `URL` keeps invalid percent sequences such as `%zz` as they are, and
// `decodeURIComponent` throws on them. Fall back to the raw value so a
// malformed endpoint reaches the RPC client instead of crashing here.
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Collect the parts of a configured value that may hold a credential.
 *
 * - For a URL: the userinfo, the long path segments, and the long query
 *   values. RPC providers put API keys in any of these places.
 * - For anything else (e.g. a bearer token): the whole string, and, for a
 *   `key=value` header (e.g. Sui `--grpc-metadata`), also the value.
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
    for (const userinfo of [url.username, url.password]) {
      if (userinfo.length >= MIN_SECRET_LENGTH) {
        secrets.push(userinfo, safeDecode(userinfo));
      }
    }
    for (const segment of url.pathname.split("/")) {
      if (segment.length >= MIN_URL_SECRET_LENGTH) {
        secrets.push(segment, safeDecode(segment));
      }
    }
    // Use the raw query values, as written in the configured URL, because
    // that is how clients such as viem log them. `searchParams` would
    // normalize the encoding (e.g. `%2f` to `/` and back to `%2F`).
    for (const param of url.search.slice(1).split("&")) {
      const eq = param.indexOf("=");
      const raw = eq === -1 ? "" : param.slice(eq + 1);
      if (raw.length >= MIN_URL_SECRET_LENGTH) {
        secrets.push(raw, safeDecode(raw.replaceAll("+", " ")));
      }
    }
    return secrets;
  }

  // A raw token (e.g. a base64 token ending in `=`) may contain `=`, so
  // always keep the whole string. When it is a `key=value` header, the value
  // is the credential and may be logged on its own.
  const secrets = [trimmed];
  const eq = trimmed.indexOf("=");
  if (eq !== -1) {
    const headerValue = trimmed.slice(eq + 1);
    if (headerValue.length >= MIN_SECRET_LENGTH) {
      secrets.push(headerValue);
    }
  }
  return secrets;
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
 *
 * It also sets the process-wide redactor used by `redactSecrets`. The CLI
 * builds one logger per run, so the last call wins.
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
