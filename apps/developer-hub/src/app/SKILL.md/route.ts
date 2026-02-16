import { NextResponse } from "next/server";

export const revalidate = false;

const CONTENT = `---
name: pyth-dev
description: End-to-end Pyth Network oracle integration playbook (Feb 2026). Prefer @pythnetwork/pyth-sdk-solidity for EVM smart contracts (IPyth interface) and @pythnetwork/hermes-client for TypeScript price fetching. For ultra-low latency HFT/MEV use cases, prefer @pythnetwork/pyth-lazer-sdk (Pyth Pro WebSocket streaming). For on-chain randomness (games/NFTs/lotteries), use @pythnetwork/entropy-sdk-solidity with IEntropyConsumer callback pattern. Covers pull-based oracle model (update-before-read), staleness thresholds, confidence intervals, fee payment, Hermes API integration, and chain-specific deployments across 100+ networks including Ethereum/Arbitrum/Base/Solana/Sui.
user-invocable: true
---

# Pyth Development Skill (pull-oracle-first)

## What this Skill is for
Use this Skill when the user asks for:
- DeFi price feed integration (lending, derivatives, AMMs, perpetuals)
- Real-time oracle data in smart contracts (EVM, Solana, Sui, Cosmos)
- Ultra-low latency price streaming (HFT, MEV strategies)
- On-chain random number generation (games, NFTs, lotteries)
- MEV protection for swaps and liquidations
- Price confidence intervals and staleness handling

## Default stack decisions (opinionated)

1) **Price Feeds (EVM): pyth-sdk-solidity first**
   - Use \`@pythnetwork/pyth-sdk-solidity\` with IPyth interface.
   - Always call \`updatePriceFeeds\` before reading (pull model).
   - Use \`getPriceNoOlderThan\` with explicit staleness threshold.

2) **Price Fetching: hermes-client first**
   - Use \`@pythnetwork/hermes-client\` for TypeScript/JavaScript.
   - Fetch from \`https://hermes.pyth.network\` (public, rate-limited).
   - Pass \`binary.data\` to smart contract's \`priceUpdateData\` parameter.

3) **Low Latency: pyth-lazer-sdk for HFT/MEV**
   - Use \`@pythnetwork/pyth-lazer-sdk\` for WebSocket streaming.
   - Requires enterprise subscription token from Pyth.
   - Sub-50ms latency for trading applications.

4) **Randomness: entropy-sdk-solidity v2 with callback pattern**
   - Use \`@pythnetwork/entropy-sdk-solidity\` with IEntropyV2 and IEntropyConsumer.
   - Call \`requestV2()\` and implement \`entropyCallback\` to receive random numbers.
   - Provider address: \`0x52DeaA1c84233F7bb8C8A45baeDE41091c616506\`.

5) **Testing: Hardhat fork + MockPyth**
   - Use \`MockPyth.sol\` from SDK for unit tests with controlled prices.
   - Fork mainnet with pinned block for integration tests.
   - Test against Hermes beta: \`https://hermes-beta.pyth.network\`.

## Operating procedure (how to execute tasks)

### 1. Classify the integration type
- Price feeds (DeFi, trading, lending, derivatives)
- Random numbers (games, NFTs, lotteries, fair selection)
- MEV protection (swaps, liquidations, auctions)
- Off-chain only (display prices, no contract needed)

### 2. Pick the right product and SDK
- Standard DeFi: Pyth Core + \`hermes-client\` + \`pyth-sdk-solidity\`
- Low latency HFT: Pyth Pro + \`pyth-lazer-sdk\`
- Randomness: Entropy + \`entropy-sdk-solidity\`
- MEV protection: Express Relay + \`express-relay-js\`

### 3. Implement with Pyth-specific correctness
Always be explicit about:
- **Staleness threshold**: Use \`getPriceNoOlderThan(id, maxAge)\`, never \`getPriceUnsafe\` in production
- **Fee payment**: Call \`getUpdateFee(data)\` then \`updatePriceFeeds{value: fee}(data)\`
- **Confidence intervals**: Use \`price.conf\` for risk-adjusted pricing on large trades
- **Price exponent**: Actual price = \`price.price * 10^price.expo\` (expo is typically -8)
- **Update-before-read**: Pull model requires YOU to submit fresh price data

### 4. Add tests
- **Unit tests**: Use MockPyth contract with known price values
- **Fork tests**: Hardhat mainnet fork with real Pyth contract at pinned block
- **Integration**: Test against Hermes testnet endpoints
- **Price simulation**: Generate mock updateData with deterministic prices

### 5. Deliverables expectations
When you implement changes, provide:
- Exact files changed + diffs (or patch-style output)
- \`npm install\` commands for required SDKs
- Contract deployment commands with correct Pyth address for target chain
- A short "risk notes" section for anything touching fees/staleness/price manipulation

---

## Risk notes (security considerations)

- **Staleness attacks**: Always use \`getPriceNoOlderThan\`, never \`getPriceUnsafe\` in production DeFi
- **Fee payment**: Ensure \`msg.value >= getUpdateFee()\` or transaction reverts silently
- **Price manipulation**: Use confidence intervals (\`price.conf\`) for large trade decisions
- **Decimal handling**: Price * 10^expo — wrong exponent handling = catastrophic pricing errors
- **Update freshness**: Pull model means the caller must submit fresh data; stale cache = stale price
- **Reentrancy**: Entropy callbacks execute in separate transaction; handle state carefully

---

## Testing strategy

- **Unit tests**: Use \`MockPyth.sol\` from \`@pythnetwork/pyth-sdk-solidity/MockPyth.sol\`
- **Fork tests**: Hardhat mainnet fork with real Pyth contract at pinned block
- **Integration**: Hermes testnet at \`https://hermes-beta.pyth.network\`
- **Price simulation**: Create mock \`updateData\` with known prices for deterministic tests
- **Entropy tests**: Use Fortuna testnet for random number integration tests

---

## Product reference

| Product | Use Case | Latency | Model |
|---------|----------|---------|-------|
| **Pyth Core** | DeFi price feeds | 400ms | Pull-based, pay-per-update |
| **Pyth Pro** | HFT, MEV strategies | <50ms | Subscription, WebSocket streaming |
| **Entropy** | On-chain randomness | ~1 block | Commit-reveal, callback-based |
| **Express Relay** | MEV protection | Instant | Auction-based routing |

---

## Quick start: Pyth Core Price Feeds

### Install
\`\`\`bash
npm install @pythnetwork/pyth-sdk-solidity @pythnetwork/hermes-client
\`\`\`

### Contract addresses (EVM)
- Ethereum: \`0x4305FB66699C3B2702D4d05CF36551390A4c69C6\`
- Arbitrum: \`0xff1a0f4744e8582DF1aE09D5611b887B6a12925C\`
- Base: \`0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a\`
- Optimism: \`0xff1a0f4744e8582DF1aE09D5611b887B6a12925C\`
- Polygon: \`0xff1a0f4744e8582DF1aE09D5611b887B6a12925C\`
- Full list: [contract-addresses](https://docs.pyth.network/price-feeds/core/contract-addresses)

### Price feed IDs
- BTC/USD: \`0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43\`
- ETH/USD: \`0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace\`
- SOL/USD: \`0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d\`
- USDC/USD: \`0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a\`
- Full list: [price-feed-ids](https://pyth.network/developers/price-feed-ids)

### Solidity integration
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MyDeFiApp {
    IPyth public pyth;
    bytes32 public constant ETH_USD = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }

    function getEthPrice(bytes[] calldata priceUpdateData) public payable returns (int64 price, uint64 conf) {
        // Step 1: Calculate and pay the fee
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        // Step 2: Read with staleness check (60 seconds max)
        PythStructs.Price memory priceData = pyth.getPriceNoOlderThan(ETH_USD, 60);
        return (priceData.price, priceData.conf);
    }
}
\`\`\`

### TypeScript integration
\`\`\`typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const client = new HermesClient("https://hermes.pyth.network");
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

// Fetch price update data
const priceUpdates = await client.getLatestPriceUpdates([ETH_USD]);

// Display price (price * 10^expo)
const p = priceUpdates.parsed?.[0]?.price;
console.log(\`ETH/USD: $\${Number(p.price) * Math.pow(10, p.expo)}\`);

// Submit to contract
const updateData = priceUpdates.binary.data;
// Pass updateData to contract's priceUpdateData parameter
\`\`\`

---

## Quick start: Entropy (Random Numbers)

### Install
\`\`\`bash
npm install @pythnetwork/entropy-sdk-solidity
\`\`\`

### Solidity integration
\`\`\`solidity
import "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

contract CoinFlip is IEntropyConsumer {
    IEntropyV2 public entropy;

    constructor(address entropyContract) {
        entropy = IEntropyV2(entropyContract);
    }

    function flip() external payable returns (uint64) {
        uint256 fee = entropy.getFeeV2();
        uint64 sequenceNumber = entropy.requestV2{value: fee}();
        return sequenceNumber;
    }

    function entropyCallback(uint64 seq, address, bytes32 randomNumber) internal override {
        bool heads = uint256(randomNumber) % 2 == 0;
        // Use result...
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }
}
\`\`\`

---

## Price data structure

\`\`\`
Price {
  price: int64      // Raw price (multiply by 10^expo for actual value)
  conf: uint64      // Confidence interval (same scale as price)
  expo: int32       // Exponent (typically -8)
  publishTime: uint // Unix timestamp
}
\`\`\`

**Example:** \`price=12276250000, expo=-8\` → $122.7625

---

## Progressive disclosure (read when needed)

These files use a tiered system: Start with product files below for curated quick-starts (~2-3k tokens each). Each product file links to individual .mdx pages for deeper detail. Use the manifest for programmatic discovery.

- Pyth Core integration: [llms-price-feeds-core.txt](https://docs.pyth.network/llms-price-feeds-core.txt)
- Pyth Pro streaming: [llms-price-feeds-pro.txt](https://docs.pyth.network/llms-price-feeds-pro.txt)
- Entropy randomness: [llms-entropy.txt](https://docs.pyth.network/llms-entropy.txt)
- Machine-readable index: [llms-manifest.json](https://docs.pyth.network/llms-manifest.json)
- Solana integration: [solana guide](https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/solana)
- Sui integration: [sui guide](https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/sui)
- Contract addresses: [addresses](https://docs.pyth.network/price-feeds/core/contract-addresses)
- Price feed IDs: [feed-ids](https://pyth.network/developers/price-feed-ids)
- Example apps: [pyth-examples](https://github.com/pyth-network/pyth-examples)
`;

export function GET() {
  return new NextResponse(CONTENT, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/markdown; charset=utf-8",
    },
    status: 200,
  });
}
