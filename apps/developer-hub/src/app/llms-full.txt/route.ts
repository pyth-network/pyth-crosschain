import { NextResponse } from "next/server";

export const revalidate = false;

export function GET() {
  const content = `# Pyth Network - Full Documentation

This file has been replaced by product-specific documentation files for more efficient context loading.

Please read https://docs.pyth.network/llms.txt for routing to the right file.

## Quick Routing

- On-chain price oracles / DeFi: https://docs.pyth.network/llms-price-feeds-core.txt
- HFT / MEV / WebSocket streaming: https://docs.pyth.network/llms-price-feeds-pro.txt
- Random numbers / games / NFTs: https://docs.pyth.network/llms-entropy.txt
- All price feeds (Core + Pro): https://docs.pyth.network/llms-price-feeds.txt
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
