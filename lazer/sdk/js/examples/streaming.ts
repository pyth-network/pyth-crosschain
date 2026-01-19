/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable unicorn/prefer-top-level-await */


import { PythLazerClient } from "../src/index.js";

// Ignore debug messages
console.debug = () => {};

const client = await PythLazerClient.create({
  token: "-", // Replace with your actual access token
  logger: console, // Optionally log operations (to the console in this case.)
  webSocketPoolConfig: {
    urls: [
      "wss://router-0.pyth-lazer-yellow.dourolabs.app/v1/stream",
      "wss://router-1.pyth-lazer-yellow.dourolabs.app/v1/stream",
    ],
    numConnections: 4, // Optionally specify number of parallel redundant connections to reduce the chance of dropped messages. The connections will round-robin across the provided URLs. Default is 4.
    onError: (error) => {
      // console.error("WebSocket error:", error);
    },
    // Optional configuration for resilient WebSocket connections
    rwsConfig: {
      heartbeatTimeoutDurationMs: 5000, // Optional heartbeat timeout duration in milliseconds
      maxRetryDelayMs: 1000, // Optional maximum retry delay in milliseconds
      logAfterRetryCount: 10, // Optional log after how many retries
    },
  },
});

let prev = 0;

// Add a listener to read and display messages from the Lazer stream
client.addMessageListener((message) => {
  switch (message.type) {
    case "json": {
      if (message.value.type == "streamUpdated") {
        const timestamp = message.value.parsed?.timestampUs;
        const timestampint = Number.parseInt(timestamp ?? "0") / 200 / 1000;
        const value = message.value.parsed?.priceFeeds[0]?.price;
        const now = Date.now();

        console.log(`Latency: ${now - (timestampint * 200)} ms ## Price: ${value}`);

        if (timestampint > prev + 1) {
          console.log(`Missed ${(timestampint - prev - 1).toString()} messages`);
        }
        if (timestampint % 10 === 0) {
        console.log(timestampint)
        }
        prev = timestampint;
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
  deliveryFormat: "json",
  channel: "fixed_rate@200ms",
  parsed: true,
  jsonBinaryEncoding: "base64",
});


await new Promise((resolve) => setTimeout(resolve, 300_000_000));

client.unsubscribe(1);
client.unsubscribe(2);
client.unsubscribe(3);

// Clear screen and move cursor to top
process.stdout.write("\u001B[2J\u001B[H");
console.log("🛑 Shutting down Pyth Lazer demo after 30 seconds...");
console.log("👋 Goodbye!");

client.shutdown();
