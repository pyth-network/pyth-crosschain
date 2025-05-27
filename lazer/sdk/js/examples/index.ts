/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */

import { PythLazerClient } from "../src/index.js";

// Ignore debug messages
console.debug = () => {};

const client = await PythLazerClient.create({
  urls: [
    "wss://pyth-lazer-0.dourolabs.app/v1/stream",
    "wss://pyth-lazer-1.dourolabs.app/v1/stream",
  ],
  token: "you-access-token-here", // Replace with your actual access token
  numConnections: 4, // Optionally specify number of parallel redundant connections to reduce the chance of dropped messages. The connections will round-robin across the provided URLs. Default is 4.
  logger: console, // Optionally log socket operations (to the console in this case.)
  onError: (error) => {
    console.error("WebSocket error:", error);
  },
  // Optional configuration for resilient WebSocket connections
  rwsConfig: {
    heartbeatTimeoutDurationMs: 5000, // Optional heartbeat timeout duration in milliseconds
    maxRetryDelayMs: 1000, // Optional maximum retry delay in milliseconds
    logAfterRetryCount: 10, // Optional log after how many retries
  },
});

// Read and process messages from the Lazer stream
client.addMessageListener((message) => {
  console.info("got message:", message);
  switch (message.type) {
    case "json": {
      if (message.value.type == "streamUpdated") {
        console.info(
          "stream updated for subscription",
          message.value.subscriptionId,
          ":",
          message.value.parsed?.priceFeeds,
        );
      }
      break;
    }
    case "binary": {
      if ("solana" in message.value) {
        console.info("solana message:", message.value.solana?.toString("hex"));
      }
      if ("evm" in message.value) {
        console.info("evm message:", message.value.evm?.toString("hex"));
      }
      break;
    }
  }
});

// Monitor for all connections in the pool being down simultaneously (e.g. if the internet goes down)
// The connections may still try to reconnect in the background. To shut down the client completely, call shutdown().
client.addAllConnectionsDownListener(() => {
  console.error("All connections are down!");
});

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

await new Promise((resolve) => setTimeout(resolve, 10_000));

client.unsubscribe(1);
client.unsubscribe(2);
client.shutdown();
