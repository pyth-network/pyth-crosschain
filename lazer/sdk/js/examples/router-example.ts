import { PythLazerClient } from "../src/index.js";

const client = await PythLazerClient.create({
  urls: ["wss://router.pyth-lazer.dourolabs.app/ws"],
  token: "",
  routerServiceUrl: "https://router.pyth-lazer.dourolabs.app",
});

// Example 1: Get latest price for BTC using feed IDs
await client.get_latest_price({
  priceFeedIds: [1],
  properties: ["price", "confidence", "exponent"],
  formats: ["solana"],
  jsonBinaryEncoding: "hex",
  parsed: true,
  channel: "fixed_rate@200ms",
});

// Example 2: Get latest price using symbols
await client.get_latest_price({
  symbols: ["BTC/USD"],
  properties: ["price", "confidence"],
  formats: ["evm"],
  parsed: true,
  channel: "real_time",
});

// Example 3: Get historical price at specific timestamp
const historicalTimestamp = (Date.now() - 60_000) * 1000;
await client.get_price({
  timestamp: historicalTimestamp.toString(),
  priceFeedIds: [1],
  properties: ["price", "publisherCount"],
  formats: ["solana"],
  parsed: true,
  channel: "fixed_rate@200ms",
});

// Example 4: Get multiple feeds with different formats
await client.get_latest_price({
  priceFeedIds: [1, 2, 3],
  properties: ["price", "confidence", "exponent", "publisherCount"],
  formats: ["evm", "solana"],
  jsonBinaryEncoding: "base64",
  parsed: true,
  channel: "fixed_rate@50ms",
});

client.shutdown();
