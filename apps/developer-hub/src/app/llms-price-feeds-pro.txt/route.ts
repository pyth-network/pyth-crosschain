import { NextResponse } from "next/server";

import { getLLMTextByPaths } from "../../lib/get-llm-text";

export const revalidate = false;

const STATIC_HEADER = `# Pyth Pro - Complete Documentation

> Enterprise-grade, ultra-low latency price data for professional trading applications.
> This file contains complete Pyth Pro documentation. No other files need to be fetched.

Pyth Pro (formerly Lazer) is a subscription-based service designed for high-frequency trading, MEV strategies, and latency-sensitive applications. It provides direct WebSocket streaming with customizable channels.

## Key Features
- **Ultra-low latency** - Optimized for HFT and MEV applications
- **Direct WebSocket streaming** - Real-time price delivery
- **Customizable channels** - Configure delivery to your needs
- **Dedicated support** - Enterprise-grade service
- **Crypto, Equities, Indexes** - Comprehensive asset coverage

## Quick Start (TypeScript)

\`\`\`typescript
import { PythProClient } from "@pythnetwork/pyth-pro-client";

// Connect to Pyth Pro WebSocket
const client = new PythProClient({
  subscriptionId: "your-subscription-id",
  endpoint: "wss://pro.pyth.network"
});

// Subscribe to price feeds
client.subscribe(["BTC/USD", "ETH/USD"], (price) => {
  console.log(\`\${price.symbol}: \${price.price}\`);
});
\`\`\`

## Integration Flow
1. **Subscribe** - Contact Pyth team for subscription access
2. **Connect** - Use WebSocket client to connect to Pyth Pro
3. **Stream** - Receive ultra-low latency price updates
4. **Verify** - Optionally verify prices on-chain

## Subscription
Contact the Pyth team for subscription access:
- Website: https://pyth.network/pro
- Discord: https://discord.gg/pythnetwork

## Use Cases
- **High-frequency trading** - Sub-millisecond price updates
- **MEV strategies** - Arbitrage and liquidation bots
- **Market making** - Real-time spread management
- **Risk management** - Instant price monitoring

---

## Detailed Documentation

`;

export async function GET() {
  const pathPrefixes = ["/price-feeds/pro"];

  const scanned = await getLLMTextByPaths(pathPrefixes);

  const content = [
    STATIC_HEADER,
    `Generated on: ${new Date().toISOString()}`,
    "",
    ...scanned,
  ].join("\n");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
