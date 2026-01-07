import type { PlaygroundConfig } from "../types";

/**
 * Generates CLI code using wscat for WebSocket connections
 */
export function generateCliCode(config: PlaygroundConfig): string {
  // If accessToken is empty, use demo token placeholder
  const token = config.accessToken.trim() || "DEMO_TOKEN";
  const priceFeedIds = config.priceFeedIds.length > 0 ? config.priceFeedIds : [1, 2];
  const properties = config.properties.length > 0 ? config.properties : ["price"];
  const chains = config.formats.length > 0 ? config.formats : ["solana"];
  const channel = config.channel;

  const subscribePayload = {
    type: "subscribe",
    subscriptionId: 1,
    priceFeedIds,
    properties,
    chains,
    channel,
    deliveryFormat: config.deliveryFormat,
    jsonBinaryEncoding: config.jsonBinaryEncoding,
    parsed: config.parsed,
  };

  const payloadStr = JSON.stringify(subscribePayload);

  return `# Install wscat if not already installed
npm install -g wscat

# Connect to Pyth Lazer WebSocket with authentication
# Replace YOUR_ACCESS_TOKEN with your actual token
wscat -c "wss://pyth-lazer-0.dourolabs.app/v1/stream" \\
  -H "Authorization: Bearer ${token}"

# Once connected, send this subscription message:
${payloadStr}

# Alternative: Using curl for one-shot requests (HTTP API)
curl -X POST "https://pyth-lazer-0.dourolabs.app/v1/latest_price" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ priceFeedIds, properties, chains, parsed: config.parsed })}'

# For redundancy, connect to multiple endpoints:
# - wss://pyth-lazer-0.dourolabs.app/v1/stream
# - wss://pyth-lazer-1.dourolabs.app/v1/stream
# - wss://pyth-lazer-2.dourolabs.app/v1/stream
`;
}


