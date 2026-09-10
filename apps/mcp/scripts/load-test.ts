#!/usr/bin/env npx tsx
/**
 * Load test script for Pyth MCP free tools.
 * Sends random bursts of 1-10 requests per second with random 1-3s pauses.
 * Runs for 1 hour by default.
 *
 * Usage: npx tsx scripts/load-test.ts [MCP_URL]
 * Default URL: http://localhost:8080/mcp
 */

const MCP_URL = process.argv[2] || "http://localhost:8080/mcp";
const DURATION_MS = 60 * 60 * 1000; // 1 hour

// --- Query generators ---

const ASSET_TYPES = [
  "crypto",
  "fx",
  "equity",
  "metal",
  "rates",
  "commodity",
  "funding-rate",
] as const;

const SEARCH_QUERIES = [
  "BTC",
  "ETH",
  "SOL",
  "AAPL",
  "MSFT",
  "GOOG",
  "gold",
  "silver",
  "EUR",
  "GBP",
  "JPY",
  "oil",
  "DOGE",
  "AVAX",
  "MATIC",
  "LINK",
  "UNI",
  "AAVE",
  "ADA",
  "DOT",
  "XRP",
  "ATOM",
  "NEAR",
  "ARB",
  "OP",
  "copper",
  "platinum",
  "natural gas",
  "wheat",
  "corn",
];

const SYMBOLS = [
  "Crypto.BTC/USD",
  "Crypto.ETH/USD",
  "Crypto.SOL/USD",
  "Crypto.DOGE/USD",
  "Crypto.AVAX/USD",
  "Crypto.LINK/USD",
  "Crypto.UNI/USD",
  "Crypto.ADA/USD",
  "Crypto.DOT/USD",
  "Crypto.XRP/USD",
  "Crypto.ATOM/USD",
  "Crypto.NEAR/USD",
  "Crypto.ARB/USD",
  "Crypto.OP/USD",
  "FX.EUR/USD",
  "FX.GBP/USD",
  "FX.JPY/USD",
  "Metal.XAU/USD",
  "Metal.XAG/USD",
  "Equity.US.AAPL/USD",
  "Equity.US.MSFT/USD",
  "Equity.US.GOOG/USD",
];

const RESOLUTIONS = [
  "1",
  "5",
  "15",
  "30",
  "60",
  "120",
  "240",
  "360",
  "720",
  "D",
  "W",
  "M",
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a random timestamp between April 2025 and now
function randomTimestamp(): number {
  const april2025 = new Date("2025-04-01").getTime() / 1000;
  const now = Math.floor(Date.now() / 1000);
  return randInt(Math.floor(april2025), now);
}

type ToolCall = {
  method: "tools/call";
  params: { name: string; arguments: Record<string, unknown> };
};

function makeGetSymbols(): ToolCall {
  const args: Record<string, unknown> = {};

  const variant = randInt(0, 4);
  switch (variant) {
    case 0: // bare call
      break;
    case 1: // filter by asset type
      args.asset_type = pick(ASSET_TYPES);
      break;
    case 2: // search query
      args.query = pick(SEARCH_QUERIES);
      break;
    case 3: // asset type + query
      args.asset_type = pick(ASSET_TYPES);
      args.query = pick(SEARCH_QUERIES);
      break;
    case 4: // pagination
      args.limit = randInt(1, 200);
      args.offset = randInt(0, 100);
      break;
  }

  return { method: "tools/call", params: { name: "get_symbols", arguments: args } };
}

function makeGetCandlestick(): ToolCall {
  const from = randomTimestamp();
  const resolution = pick(RESOLUTIONS);

  // Make "to" sensible relative to resolution
  let durationSec: number;
  switch (resolution) {
    case "D":
      durationSec = randInt(1, 30) * 86400;
      break;
    case "W":
      durationSec = randInt(1, 12) * 7 * 86400;
      break;
    case "M":
      durationSec = randInt(1, 6) * 30 * 86400;
      break;
    default:
      durationSec = randInt(10, 200) * parseInt(resolution) * 60;
      break;
  }

  return {
    method: "tools/call",
    params: {
      name: "get_candlestick_data",
      arguments: {
        symbol: pick(SYMBOLS),
        resolution,
        from,
        to: from + durationSec,
      },
    },
  };
}

function makeGetHistoricalPrice(): ToolCall {
  const useSymbols = Math.random() > 0.5;
  const count = randInt(1, 5);
  const args: Record<string, unknown> = {
    timestamp: randomTimestamp(),
  };

  if (useSymbols) {
    const syms: string[] = [];
    for (let i = 0; i < count; i++) syms.push(pick(SYMBOLS));
    args.symbols = [...new Set(syms)];
  } else {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) ids.push(randInt(1, 500));
    args.price_feed_ids = [...new Set(ids)];
  }

  return {
    method: "tools/call",
    params: { name: "get_historical_price", arguments: args },
  };
}

const GENERATORS = [makeGetSymbols, makeGetCandlestick, makeGetHistoricalPrice];

// --- MCP HTTP client ---

let jsonRpcId = 1;

// Per-session state
let sessionId: string | undefined;
let initPromise: Promise<void> | undefined;

async function sendJsonRpc(
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: jsonRpcId++,
    method,
    params,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const res = await fetch(MCP_URL, { method: "POST", headers, body });

  // Capture session ID from response
  const newSid = res.headers.get("mcp-session-id");
  if (newSid) sessionId = newSid;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    // Parse SSE - collect all data events
    const text = await res.text();
    const lines = text.split("\n");
    let lastData = "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        lastData = line.slice(6);
      }
    }
    return lastData ? JSON.parse(lastData) : null;
  }

  return res.json();
}

async function doInitialize(): Promise<void> {
  await sendJsonRpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "load-test", version: "1.0.0" },
  });

  // Send initialized notification (no id, no response expected)
  const notifHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionId) notifHeaders["mcp-session-id"] = sessionId;

  await fetch(MCP_URL, {
    method: "POST",
    headers: notifHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });

  console.log(`Session initialized (session-id: ${sessionId ?? "stateless"})`);
}

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = doInitialize();
  }
  return initPromise;
}

// --- Stats ---

let totalRequests = 0;
let successCount = 0;
let errorCount = 0;
const toolCounts: Record<string, number> = {};

function printStats(): void {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  console.log(
    `\n[${mins}m${secs}s] Total: ${totalRequests} | OK: ${successCount} | Err: ${errorCount} | By tool: ${JSON.stringify(toolCounts)}`,
  );
}

// --- Main loop ---

const startTime = Date.now();

async function fireRequest(): Promise<void> {
  const gen = pick(GENERATORS);
  const call = gen();
  const toolName = call.params.name;
  toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
  totalRequests++;

  try {
    await ensureInitialized();
    await sendJsonRpc(call.method, call.params);
    successCount++;
  } catch (err) {
    errorCount++;
    const msg = err instanceof Error ? err.message : String(err);
    // Only log first 100 chars to avoid noise
    console.error(`  [ERR] ${toolName}: ${msg.slice(0, 100)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log(`Load testing ${MCP_URL} for 1 hour`);
  console.log(`Free tools: get_symbols, get_candlestick_data, get_historical_price`);
  console.log(`Pattern: 1-10 requests/burst, random 0-3s pauses\n`);

  const statsInterval = setInterval(printStats, 15_000);

  while (Date.now() - startTime < DURATION_MS) {
    // Decide: burst or pause?
    if (Math.random() < 0.3) {
      // 30% chance of a pause (1-3 seconds)
      const pauseMs = randInt(1000, 3000);
      await sleep(pauseMs);
    } else {
      // Burst: 1-10 concurrent requests
      const burstSize = randInt(1, 10);
      const promises: Promise<void>[] = [];
      for (let i = 0; i < burstSize; i++) {
        promises.push(fireRequest());
      }
      await Promise.all(promises);

      // Small delay to stay within ~1 second cadence
      await sleep(randInt(100, 500));
    }
  }

  clearInterval(statsInterval);
  printStats();
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
