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
    "Your Pyth Pro access token is invalid or expired. Check your `access_token` value.",
  MISSING_TOKEN:
    "This tool requires a Pyth Pro access token. Provide an `access_token` parameter. Get a token at https://pyth.network/pricing",
  NO_DATA:
    "No candlestick data available for the requested range. Try a different time range or symbol.",
} as const;
