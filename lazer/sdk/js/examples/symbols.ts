/* eslint-disable no-console */

import { PythLazerClient } from "../src/index.js";

const client = await PythLazerClient.create({
  token: "your-token-here",
  logger: console,
});

// Example 1: Get latest price for BTC using feed IDs
console.log("\n=== Example 1: Search feeds by name/symbol ===");
const response1 = await client.getSymbols({ query: "BTC" });
console.log(response1);

// Example 2: Get latest price using symbols
console.log("\n=== Example 2: Get feeds by asset type ===");
const response2 = await client.getSymbols({
  asset_type: "equity",
});
console.log(response2);

// Example 3: Get feeds by asset type and query
console.log("\n=== Example 3: Get feeds by asset type and name/symbol ===");
const response3 = await client.getSymbols({
  asset_type: "equity",
  query: "AAPL",
});

console.log(response3);
