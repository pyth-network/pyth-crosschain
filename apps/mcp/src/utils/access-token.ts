import { z } from "zod";

// Tokens are a single run of printable ASCII. Rejecting anything else up
// front matters: a token with a line break inside (a wrapped paste) makes
// fetch throw an "invalid header value" error that quotes the whole token.
const TOKEN_PATTERN = /^[\x21-\x7E]+$/;

export const TOKEN_FORMAT_MESSAGE =
  "access_token must be a single line with no spaces or line breaks. Re-copy the token in one piece.";

export function accessTokenSchema(description: string) {
  return z
    .string()
    .trim()
    .min(1, "access_token must not be empty")
    .regex(TOKEN_PATTERN, TOKEN_FORMAT_MESSAGE)
    .optional()
    .describe(description);
}

/**
 * The user's own key, configured once in their MCP client instead of being
 * passed on every call: the `Authorization: Bearer` header of their HTTP
 * request, or PYTH_PRO_ACCESS_TOKEN in the environment their client gives a
 * local stdio server. Never a key of the server's own. Never log it.
 */
export type ClientAccessToken =
  | { kind: "token"; token: string; source: ClientTokenSource }
  | { kind: "invalid"; message: string };

export type ClientTokenSource = "http_header" | "stdio_env";
export type TokenSource = "call" | ClientTokenSource;

/** A key from the environment the user's client gave the stdio server. */
export function clientTokenFromEnv(
  value: string | undefined,
): ClientAccessToken | undefined {
  const token = value?.trim();
  if (!token) return undefined;
  if (!TOKEN_PATTERN.test(token)) {
    return {
      kind: "invalid",
      message:
        "PYTH_PRO_ACCESS_TOKEN in your MCP client configuration must be a single line with no spaces. Fix it there, or pass `access_token` on the call.",
    };
  }
  return { kind: "token", source: "stdio_env", token };
}

/** A key from the `Authorization: Bearer <key>` header of the user's request. */
export function clientTokenFromHeader(
  header: string | string[] | undefined,
): ClientAccessToken | undefined {
  if (header === undefined) return undefined;
  const value = Array.isArray(header) ? header[0] : header;
  const match = /^\s*Bearer\s+(\S+)\s*$/i.exec(value ?? "");
  if (!match?.[1] || !TOKEN_PATTERN.test(match[1])) {
    return {
      kind: "invalid",
      message:
        "The Authorization header in your MCP client configuration must be `Bearer <your Pyth Pro access token>`. Fix it there, or pass `access_token` on the call.",
    };
  }
  return { kind: "token", source: "http_header", token: match[1] };
}

/**
 * The key a tool call uses: `access_token` on the call wins, then the key
 * from the client configuration. `error` is set when only a malformed
 * client key is available.
 */
export function resolveAccessToken(
  perCall: string | undefined,
  client: ClientAccessToken | undefined,
): { token?: string; source?: TokenSource; error?: string } {
  if (perCall) return { source: "call", token: perCall };
  if (client?.kind === "token") {
    return { source: client.source, token: client.token };
  }
  if (client?.kind === "invalid") return { error: client.message };
  return {};
}
