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
    "This tool requires your Pyth Pro access token. Pass it as the `access_token` parameter, or (local stdio setups only) set PYTH_PRO_ACCESS_TOKEN in the MCP server's environment. Get a token at https://pyth.network/pricing",
} as const;
