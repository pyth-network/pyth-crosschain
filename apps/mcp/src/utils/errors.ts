import { HttpError } from "../clients/retry.js";
import { ACCESS_TOKEN_URL } from "../constants.js";

export function toolError(message: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [{ text: message, type: "text" as const }],
    isError: true,
  };
}

export const ErrorMessages = {
  FEED_NOT_FOUND: (input: string) =>
    `Feed not found: ${input}. Use get_symbols to discover available feeds.`,
  INVALID_TOKEN:
    "Your Pyth Pro access token is invalid or expired. Check the `access_token` you passed, or the token configured in your MCP client.",
  MISSING_TOKEN: `This tool requires your Pyth Pro access token. Pass it as the \`access_token\` parameter, or configure it once in your MCP client (an \`Authorization: Bearer <token>\` header for the hosted server, or PYTH_PRO_ACCESS_TOKEN for a local stdio server). Get a token at ${ACCESS_TOKEN_URL}`,
  NOT_ENTITLED: (detail?: string) =>
    `Pyth Pro denied access (403)${detail ? `: ${detail}` : ""}. Your access token is valid, but your plan is not entitled to this feed. Pick a feed your plan covers, or contact Pyth to add the entitlement.`,
} as const;

/** 401 -> invalid token; 403 -> not entitled, or not found for "Unknown feed". */
export function authErrorFor(
  err: unknown,
):
  | { errorType: "auth" | "not_entitled" | "not_found"; message: string }
  | undefined {
  if (!(err instanceof HttpError)) return undefined;
  if (err.status === 401) {
    return { errorType: "auth", message: ErrorMessages.INVALID_TOKEN };
  }
  if (err.status === 403) {
    if (err.detail && /^unknown feed/i.test(err.detail.trim())) {
      return {
        errorType: "not_found",
        message: `Pyth Pro does not know this feed (${err.detail.trim()}). Use get_symbols to find valid feed IDs.`,
      };
    }
    return {
      errorType: "not_entitled",
      message: ErrorMessages.NOT_ENTITLED(err.detail),
    };
  }
  return undefined;
}

/** 400/404 -> Pyth's own reason; these don't go away on retry. */
export function rejectionErrorFor(
  err: unknown,
  hint: string,
): { errorType: "not_found" | "validation"; message: string } | undefined {
  if (!(err instanceof HttpError)) return undefined;
  if (err.status !== 400 && err.status !== 404) return undefined;
  // Upstream reasons may end with their own period ("symbol not found.").
  const detail = err.detail?.trim().replace(/\.+$/, "");
  return {
    errorType: err.status === 404 ? "not_found" : "validation",
    message: `Pyth Pro rejected the request (${err.status})${detail ? `: ${detail}` : ""}. ${hint}`,
  };
}
