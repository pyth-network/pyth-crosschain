/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */

import { PythLazerClient } from "../src/index.js";
import { renderFeeds, refreshFeedDisplay } from "./util.js";

// Ignore debug messages
console.debug = () => { };

// Store feed data for in-place updates
const feedData = new Map<string, {
  priceFeedId: string | number;
  price: number;
  confidence: number | null;
  exponent: number;
  lastUpdate: Date;
}>();

const client = await PythLazerClient.create({
  token: "your-token-here", // Replace with your actual access token
  logger: console, // Optionally log socket operations (to the console in this case.)
  webSocketPoolConfig: {
    urls: [
      "wss://pyth-lazer-0.dourolabs.app/v1/stream",
      "wss://pyth-lazer-1.dourolabs.app/v1/stream",
    ],
    numConnections: 4, // Optionally specify number of parallel redundant connections to reduce the chance of dropped messages. The connections will round-robin across the provided URLs. Default is 4.
    onError: (error) => {
      console.error("WebSocket error:", error);
    },
    // Optional configuration for resilient WebSocket connections
    rwsConfig: {
      heartbeatTimeoutDurationMs: 5000, // Optional heartbeat timeout duration in milliseconds
      maxRetryDelayMs: 1000, // Optional maximum retry delay in milliseconds
      logAfterRetryCount: 10, // Optional log after how many retries
    },
  },
});

// Read and display messages from the Lazer stream
client.addMessageListener((message) => {
  switch (message.type) {
    case "json": {
      if (message.value.type == "streamUpdated") {
        refreshFeedDisplay(message.value, feedData);
      }
      break;
    }
    case "binary": {
      // Print out the binary hex messages if you want:
      // if ("solana" in message.value) {
      //   console.info("solana message:", message.value.solana?.toString("hex"));
      // }
      // if ("evm" in message.value) {
      //   console.info("evm message:", message.value.evm?.toString("hex"));
      // }
      break;
    }
  }
});

// Monitor for all connections in the pool being down simultaneously (e.g. if the internet goes down)
// The connections may still try to reconnect in the background. To shut down the client completely, call shutdown().
client.addAllConnectionsDownListener(() => {
  console.error("All connections are down!");
});

renderFeeds(feedData);

// Create and remove one or more subscriptions on the fly
client.subscribe({
  type: "subscribe",
  subscriptionId: 1,
  priceFeedIds: [1, 2],
  properties: ["price"],
  formats: ["solana"],
  deliveryFormat: "binary",
  channel: "fixed_rate@200ms",
  parsed: false,
  jsonBinaryEncoding: "base64",
});
client.subscribe({
  type: "subscribe",
  subscriptionId: 2,
  priceFeedIds: [1, 2, 3, 4, 5],
  properties: ["price", "exponent", "publisherCount", "confidence"],
  formats: ["evm"],
  deliveryFormat: "json",
  channel: "fixed_rate@200ms",
  parsed: true,
  jsonBinaryEncoding: "hex",
});
client.subscribe({
  type: "subscribe",
  subscriptionId: 3,
  priceFeedIds: [1],
  properties: ["price", "confidence"],
  formats: ["solana"],
  deliveryFormat: "json",
  channel: "fixed_rate@200ms",
  parsed: true,
  jsonBinaryEncoding: "hex",
});

await new Promise((resolve) => setTimeout(resolve, 30_000));

client.unsubscribe(1);
client.unsubscribe(2);
client.unsubscribe(3);

process.stdout.write('\x1b[2J\x1b[H');
console.log('🛑 Shutting down Pyth Lazer demo after 30 seconds...');
console.log('👋 Goodbye!');

client.shutdown();
