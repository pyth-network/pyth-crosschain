import type { PlaygroundConfig } from "../types";

/**
 * Generates CLI code using wscat for WebSocket connections
 */
export function generateCliCode(config: PlaygroundConfig): string {
  const priceFeedIds =
    config.priceFeedIds.length > 0 ? config.priceFeedIds : [1, 2];
  const properties =
    config.properties.length > 0 ? config.properties : ["price"];
  const formats = config.formats.length > 0 ? config.formats : ["solana"];
  const channel = config.channel;

  const subscribePayload = {
    channel,
    deliveryFormat: config.deliveryFormat,
    formats,
    jsonBinaryEncoding: config.jsonBinaryEncoding,
    parsed: config.parsed,
    priceFeedIds,
    properties,
    subscriptionId: 1,
    type: "subscribe",
  };

  const payloadStr = JSON.stringify(subscribePayload);

  return `# Install wscat if not already installed
npm install -g wscat

# Export your API key so it never ends up in shell history or version control
export LAZER_TOKEN="your-api-key-here"

# Connect to Pyth Lazer WebSocket with authentication
wscat -c "wss://pyth-lazer-0.dourolabs.app/v1/stream" \\
  -H "Authorization: Bearer $LAZER_TOKEN"

# Once connected, send this subscription message:
${payloadStr}

# To ignore invalid feed IDs instead of failing, add "ignoreInvalidFeeds": true to the message

# Alternative: Using curl for one-shot requests (HTTP API)
curl -X POST "https://pyth-lazer-0.dourolabs.app/v1/latest_price" \\
  -H "Authorization: Bearer $LAZER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ formats, parsed: config.parsed, priceFeedIds, properties })}'

# For redundancy, connect to multiple endpoints:
# - wss://pyth-lazer-0.dourolabs.app/v1/stream
# - wss://pyth-lazer-1.dourolabs.app/v1/stream
# - wss://pyth-lazer-2.dourolabs.app/v1/stream
`;
}
