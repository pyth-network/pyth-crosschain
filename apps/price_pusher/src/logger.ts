import pino from "pino";
import type { DestinationStream, Logger } from "pino";

// RPC SDK errors (viem's HttpRequestError/RpcRequestError, the Injective SDK,
// etc.) embed the transport URL in their `message`, `stack`, `metaMessages`,
// and `url` fields. Operators routinely pass authenticated provider endpoints
// (`https://eth-mainnet.g.alchemy.com/v2/<KEY>`, `wss://...?apikey=...`), so
// logging these errors verbatim leaks the API key into structured logs. The
// serializer below scrubs the secret-bearing part of any URL it finds while
// keeping the origin for debuggability.
const URL_PATTERN = /\b(?:https?|wss?):\/\/[^\s"'`<>\\]+/gi;

const redactUrl = (raw: string): string => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const carriesSecret =
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    (url.pathname !== "" && url.pathname !== "/");
  if (!carriesSecret) return raw;
  return `${url.protocol}//${url.host}/[REDACTED]`;
};

const redactValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (typeof value === "string") return value.replace(URL_PATTERN, redactUrl);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = redactValue(val, seen);
  }
  return out;
};

// Serializes an error (or any logged value) to a plain object and strips
// secrets from the URLs it contains. Used for both the `err` and `error` log
// keys the price pusher emits.
const redactErrorSerializer = (value: unknown): unknown => {
  const serialized =
    value instanceof Error ? pino.stdSerializers.err(value) : value;
  return redactValue(serialized, new WeakSet());
};

export const createLogger = (
  level: string,
  destination?: DestinationStream,
): Logger =>
  pino(
    {
      level,
      serializers: {
        err: redactErrorSerializer,
        error: redactErrorSerializer,
      },
    },
    destination,
  );
