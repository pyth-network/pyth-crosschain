import { PythLazerClient } from "../src/index.js";
import { displayParsedPrices } from "./util.js";

const client = await PythLazerClient.create({ token: "your-token-here", logger: console });

// Example 1: Get latest price for BTC using feed IDs
console.log("\n=== Example 1: Latest BTC price (requested with feed ID) ===");
const response1 = await client.get_latest_price({
  priceFeedIds: [1],
  properties: ["price", "confidence", "exponent"],
  formats: [],
  jsonBinaryEncoding: "hex",
  parsed: true,
  channel: "fixed_rate@200ms",
});
displayParsedPrices(response1);

// Example 2: Get latest price using symbols
console.log("\n=== Example 2: Latest ETH price (requested with symbols) ===");
const response2 = await client.get_latest_price({
  // symbols: ["Crypto.ETH/USD"],
  priceFeedIds: [2],
  properties: ["price", "confidence", "exponent"],
  formats: [],
  parsed: true,
  channel: "real_time",
});
displayParsedPrices(response2);

// Example 3: Get historical price at specific timestamp
console.log("\n=== Example 3: Historical BTC price at timestamp ===");
const oneMinAgo = 1754348458565000;
console.log(`Requesting price from timestamp: ${oneMinAgo} (${new Date(oneMinAgo / 1000).toISOString()})`);
const response3 = await client.get_price({
  timestamp: oneMinAgo,
  priceFeedIds: [1],
  properties: ["price", "confidence", "exponent"],
  formats: [],
  parsed: true,
  channel: "real_time",
});
displayParsedPrices(response3);
