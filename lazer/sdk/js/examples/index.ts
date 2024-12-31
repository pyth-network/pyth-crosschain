import { PythLazerClient } from "../src/index.js";

/* eslint-disable no-console */
const client = new PythLazerClient("ws://127.0.0.1:1234/v1/stream", "ctoken1");
client.addMessageListener((message) => {
  console.log("got message:", message);
  switch (message.type) {
    case "json": {
      if (message.value.type == "streamUpdated") {
        console.log(
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
        console.log("solana message:", message.value.solana?.toString("hex"));
      }
      if ("evm" in message.value) {
        console.log("evm message:", message.value.evm?.toString("hex"));
      }
      break;
    }
  }
});
client.ws.addEventListener("open", () => {
  client.send({
    type: "subscribe",
    subscriptionId: 1,
    priceFeedIds: [1, 2],
    properties: ["price"],
    chains: ["solana"],
    deliveryFormat: "json",
    channel: "fixed_rate@200ms",
    jsonBinaryEncoding: "hex",
  });

  // Example: Update an existing subscription
  setTimeout(() => {
    client.send({
      type: "updateSubscription",
      subscriptionId: 1,
      priceFeedIds: [1, 2, 3],
      properties: ["price", "bestBidPrice"],
    });
  }, 2000); // Wait 2 seconds before updating
});
