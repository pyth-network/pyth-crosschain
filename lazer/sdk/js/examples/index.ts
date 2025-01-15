/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */

import { PythLazerClient } from "../src/index.js";

// Ignore debug messages
console.debug = () => {};

async function main() {
  const client = await PythLazerClient.create(
    ["wss://pyth-lazer.dourolabs.app/v1/stream"],
    "access_token",
    3, // Optionally specify number of parallel redundant connections to reduce the chance of dropped messages. The connections will round-robin across the provided URLs. Default is 3.
    console // Optionally log socket operations (to the console in this case.)
  );

  // Monitor for all connections being down
  client.onAllConnectionsDown().then(() => {
    // Handle complete connection failure.
    // The connections will keep attempting to reconnect with expo backoff.
    // To shutdown the client completely, call shutdown().
    console.error("All connections are down!");
  });

  client.addMessageListener((message) => {
    console.info("got message:", message);
    switch (message.type) {
      case "json": {
        if (message.value.type == "streamUpdated") {
          console.info(
            "stream updated for subscription",
            message.value.subscriptionId,
            ":",
            message.value.parsed?.priceFeeds
          );
        }
        break;
      }
      case "binary": {
        if ("solana" in message.value) {
          console.info(
            "solana message:",
            message.value.solana?.toString("hex")
          );
        }
        if ("evm" in message.value) {
          console.info("evm message:", message.value.evm?.toString("hex"));
        }
        break;
      }
    }
  });

  // Create and remove one or more subscriptions on the fly
  await client.subscribe({
    type: "subscribe",
    subscriptionId: 1,
    priceFeedIds: [1, 2],
    properties: ["price"],
    chains: ["solana"],
    deliveryFormat: "binary",
    channel: "fixed_rate@200ms",
    parsed: false,
    jsonBinaryEncoding: "base64",
  });
  await client.subscribe({
    type: "subscribe",
    subscriptionId: 2,
    priceFeedIds: [1, 2, 3, 4, 5],
    properties: ["price"],
    chains: ["evm"],
    deliveryFormat: "json",
    channel: "fixed_rate@200ms",
    parsed: true,
    jsonBinaryEncoding: "hex",
  });

  await new Promise((resolve) => setTimeout(resolve, 10_000));

  await client.unsubscribe(1);
  await client.unsubscribe(2);
  client.shutdown();
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
