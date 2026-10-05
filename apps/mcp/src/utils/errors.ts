import { HttpError } from "../clients/retry.js";

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
    "Your Pyth Pro access token is invalid or expired. Check the `access_token` you passed.",
  MISSING_TOKEN:
    "This tool requires your Pyth Pro access token. Pass it as the `access_token` parameter. Get a token at https://pyth.network/pricing",
  NOT_ENTITLED: (detail?: string) =>
    `Pyth Pro denied access (403)${detail ? `: ${detail}` : ""}. Your access token is valid, but your plan is not entitled to this feed. Pick a feed your plan covers, or contact Pyth to add the entitlement.`,
} as const;

/**
 * Map an upstream auth failure to a tool error message: 401 means the token
 * is invalid or expired, 403 means the token is valid but not entitled to a
 * requested feed. Returns undefined for any other error.
 */
export function authErrorFor(
  err: unknown,
): { errorType: "auth" | "not_entitled"; message: string } | undefined {
  if (!(err instanceof HttpError)) return undefined;
  if (err.status === 401) {
    return { errorType: "auth", message: ErrorMessages.INVALID_TOKEN };
  }
  if (err.status === 403) {
    return {
      errorType: "not_entitled",
      message: ErrorMessages.NOT_ENTITLED(err.detail),
    };
  }
  return undefined;
}
