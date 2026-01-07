import type { PlaygroundConfig } from "../types";

/**
 * Generates TypeScript code using the pyth-lazer-sdk package
 */
export function generateTypeScriptCode(config: PlaygroundConfig): string {
  // If accessToken is empty, use demo token placeholder
  const token = config.accessToken.trim() || "DEMO_TOKEN";
  const priceFeedIds =
    config.priceFeedIds.length > 0 ? config.priceFeedIds : [1, 2];
  const properties =
    config.properties.length > 0 ? config.properties : ["price"];
  const chains = config.formats.length > 0 ? config.formats : ["solana"];
  const channel = config.channel;

  const propertiesStr = properties.map((prop) => `"${prop}"`).join(", ");
  const chainsStr = chains.map((chain) => `"${chain}"`).join(", ");
  const priceFeedIdsStr = priceFeedIds.join(", ");

  return `import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";

// Create the Pyth Lazer client with WebSocket pool configuration
const client = await PythLazerClient.create({
  token: "${token}",
  webSocketPoolConfig: {
    urls: [
      "wss://pyth-lazer-0.dourolabs.app/v1/stream",
      "wss://pyth-lazer-1.dourolabs.app/v1/stream",
      "wss://pyth-lazer-2.dourolabs.app/v1/stream",
    ],
  },
});

// Subscribe to price feeds
client.subscribe({
  type: "subscribe",
  subscriptionId: 1,
  priceFeedIds: [${priceFeedIdsStr}],
  properties: [${propertiesStr}],
  chains: [${chainsStr}],
  channel: "${channel}",
  deliveryFormat: "${config.deliveryFormat}",
  jsonBinaryEncoding: "${config.jsonBinaryEncoding}",
  parsed: ${String(config.parsed)},
});

// Listen for price updates
client.addMessageListener((message) => {
  if (message.type === "json") {
    console.log("Received JSON update:", JSON.stringify(message.value, null, 2));
  } else {
    console.log("Received binary update:", {
      subscriptionId: message.value.subscriptionId,
      parsed: message.value.parsed,
    });
  }
});

// Handle connection errors
client.addAllConnectionsDownListener(() => {
  console.error("All WebSocket connections are down!");
});

// To unsubscribe later:
// client.unsubscribe(1);

// To shutdown the client:
// client.shutdown();
`;
}
