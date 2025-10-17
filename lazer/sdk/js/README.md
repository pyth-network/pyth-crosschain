# pyth-lazer-sdk - Readme

## Contributing & Development

See [contributing.md](docs/contributing/contributing.md) for information on how to develop or contribute to this project!

## How to use

```javascript
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";

const c = await PythLazerClient.create({
  token: "YOUR-AUTH-TOKEN-HERE",
  logger: console, // Optionally log operations (to the console in this case.)
  webSocketPoolConfig: {
    numConnections: 4, // Optionally specify number of parallel redundant connections to reduce the chance of dropped messages. The connections will round-robin across the provided URLs. Default is 4.
    onError: (error) => {
      console.error("⛔️ WebSocket error:", error.message);
    },
    // Optional configuration for resilient WebSocket connections
    rwsConfig: {
      heartbeatTimeoutDurationMs: 5000, // Optional heartbeat timeout duration in milliseconds
      maxRetryDelayMs: 1000, // Optional maximum retry delay in milliseconds
      logAfterRetryCount: 10, // Optional log after how many retries
    },
  },
});

c.addMessageListener((message) => {
  console.info("received the following from the Lazer stream:", message);
});

// Monitor for all connections in the pool being down simultaneously (e.g. if the internet goes down)
// The connections may still try to reconnect in the background. To shut down the client completely, call shutdown().
c.addAllConnectionsDownListener(() => {
  console.error("All connections are down!");
});

// Create and remove one or more subscriptions on the fly
c.subscribe({
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
c.subscribe({
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
```
