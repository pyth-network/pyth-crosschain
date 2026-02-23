import { NextResponse } from "next/server";

export const revalidate = false;

const CONTENT = `# This endpoint is deprecated

Pyth documentation is now served through a tiered system for more efficient AI agent context loading.

1. Start here: https://docs.pyth.network/llms.txt
2. Machine-readable index: https://docs.pyth.network/llms-manifest.json

The monolithic full-documentation file has been replaced by curated, product-specific files.

## Quick Routing

- On-chain price oracles / DeFi: https://docs.pyth.network/llms-price-feeds-core.txt
- HFT / MEV / WebSocket streaming: https://docs.pyth.network/llms-price-feeds-pro.txt
- Random numbers / games / NFTs: https://docs.pyth.network/llms-entropy.txt
- All price feeds (Core + Pro): https://docs.pyth.network/llms-price-feeds.txt
`;

export function GET() {
  return new NextResponse(CONTENT, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 410,
  });
}
