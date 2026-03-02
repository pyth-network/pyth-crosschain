/**
 * Secret redaction for logs and error payloads.
 * Ensures access_token, Bearer tokens, and auth headers never appear in logs or responses.
 */

const SECRET_KEYS = new Set([
  "access_token",
  "accessToken",
  "authorization",
  "token",
  "api_key",
  "apiKey",
  "secret",
  "password",
]);

const REDACTED = "[REDACTED]";

/** Recursively redact known secret keys from a plain object. */
export function redactSecrets<T>(obj: T): T {
  if (obj == null) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSecrets(item)) as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    const isSecret =
      SECRET_KEYS.has(key) ||
      SECRET_KEYS.has(lower) ||
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("auth") ||
      lower === "authorization";
    if (isSecret && value != null) {
      out[key] = REDACTED;
    } else if (value != null && typeof value === "object" && !(value instanceof Error)) {
      out[key] = redactSecrets(value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/** Redact Bearer token from Authorization header value. */
export function redactAuthHeader(value: string | undefined): string {
  if (!value) return "";
  if (/^Bearer\s+/i.test(value)) return "Bearer [REDACTED]";
  return REDACTED;
}

/** Safe string for logging — never logs raw tokens. */
export function safeForLog(value: unknown): unknown {
  if (typeof value === "string") {
    if (/^sk_|pk_|Bearer\s/i.test(value)) return REDACTED;
    return value;
  }
  if (value != null && typeof value === "object") {
    return redactSecrets(value);
  }
  return value;
}
