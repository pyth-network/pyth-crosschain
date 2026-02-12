import { NextResponse } from "next/server";

export const revalidate = false;

const CONTENT = `# Pyth Entropy — Quick Start

> Secure, verifiable on-chain random number generation using commit-reveal.
> This file contains a curated quick-start. For full docs, fetch individual pages below.

## Overview

Pyth Entropy provides cryptographically secure, verifiable randomness for blockchain applications. Built on a commit-reveal protocol, it ensures that neither the user nor the provider can predict or manipulate the random outcome.

The flow is simple: your contract requests randomness (paying a small fee), and Entropy delivers the result via a callback to your contract. The v2 API simplifies this to just two functions: \`getFeeV2()\` and \`requestV2()\`.

Use cases include gaming (dice rolls, loot drops), NFT minting (random trait assignment), lotteries (verifiable winner selection), and DeFi (random liquidation ordering).

## Key Concepts

**Commit-Reveal Protocol**: Entropy uses a hash chain where the provider pre-commits random values. When you request randomness, the final result combines your contribution with the provider's — neither party can predict the outcome alone.

**Callback Pattern**: Your contract implements \`IEntropyConsumer\` and receives randomness via the \`entropyCallback()\` function. A keeper service calls your callback once randomness is revealed.

**v2 API**: The current API uses \`IEntropyV2\`, \`requestV2()\`, and \`getFeeV2()\`. The basic \`requestV2()\` call requires no arguments — it uses sensible defaults for provider, gas, and user contribution.

**Fees**: Each request costs a small fee in native tokens. Always call \`getFeeV2()\` on-chain to get the current fee — it varies by chain and gas limit.

**Reveal Delay**: After requesting, there's a chain-specific delay before the random number is revealed and your callback is invoked. This prevents MEV attacks.

## Integration Code

### EVM (Solidity v2)

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

contract CoinFlip is IEntropyConsumer {
    IEntropyV2 public entropy;

    event FlipResult(uint64 sequenceNumber, bool isHeads);

    constructor(address entropyContract) {
        entropy = IEntropyV2(entropyContract);
    }

    // Step 1: Request randomness
    function flip() external payable returns (uint64) {
        uint256 fee = entropy.getFeeV2();
        uint64 sequenceNumber = entropy.requestV2{value: fee}();
        return sequenceNumber;
    }

    // Step 2: Receive the callback with randomness
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) internal override {
        bool isHeads = uint256(randomNumber) % 2 == 0;
        emit FlipResult(sequenceNumber, isHeads);
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }
}
\`\`\`

Install: \`npm install @pythnetwork/entropy-sdk-solidity\`
Foundry: \`@pythnetwork/entropy-sdk-solidity/=node_modules/@pythnetwork/entropy-sdk-solidity\`

## Request Variants (v2)

The \`requestV2()\` function has four overloads for different levels of control:

| Variant | Signature | Use Case |
|---------|-----------|----------|
| Basic | \`requestV2()\` | Default provider, gas, and random contribution |
| Custom Gas | \`requestV2(uint32 gasLimit)\` | When your callback needs more/less gas |
| Custom Provider | \`requestV2(address provider)\` | Use a different entropy provider |
| Full Control | \`requestV2(address provider, bytes32 userRandom, uint32 gasLimit)\` | All parameters specified |

Fee functions match: \`getFeeV2()\` for default gas, \`getFeeV2(uint32 gasLimit)\` for custom gas.

### Gas Limit Guidelines
- Simple callbacks: 50,000 – 100,000
- Moderate logic: 100,000 – 200,000
- Complex callbacks: 200,000 – 500,000+
- Gas limits are rounded up to the nearest 10,000
- Maximum: 655,350,000

## Contract Addresses

### Default Provider
- Mainnet: 0x52DeaA1c84233F7bb8C8A45baeDE41091c616506
- Testnet: 0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344

### Entropy Contracts
Contract addresses and fees vary by chain. See the full list:
https://docs.pyth.network/entropy/chainlist

### Fortuna API (Random Number Provider)
- Base URL: https://fortuna.pyth.network
- OpenAPI spec: https://fortuna.pyth.network/docs

## Transforming Random Results

The callback gives you a single \`bytes32\` random number. Transform it for your use case:

### Range Mapping
\`\`\`solidity
// Random number between 1 and 6 (dice roll)
uint256 diceRoll = (uint256(randomNumber) % 6) + 1;
\`\`\`

### Multiple Values from One Random Number
\`\`\`solidity
// Generate multiple independent random values by hashing
bytes32 rand1 = keccak256(abi.encodePacked(randomNumber, uint256(0)));
bytes32 rand2 = keccak256(abi.encodePacked(randomNumber, uint256(1)));
\`\`\`

## Common Patterns

### Fee Handling
Always fetch the fee dynamically — never hardcode it:
\`\`\`solidity
function requestRandom() external payable {
    uint256 fee = entropy.getFeeV2();
    require(msg.value >= fee, "Insufficient fee");
    entropy.requestV2{value: fee}();
}
\`\`\`

### Custom Gas for Complex Callbacks
If your callback does significant work (minting NFTs, updating storage), specify a higher gas limit:
\`\`\`solidity
uint256 fee = entropy.getFeeV2(300000);  // 300k gas
entropy.requestV2{value: fee}(300000);
\`\`\`

### Tracking Requests
Store the sequence number returned by \`requestV2()\` to correlate requests with callbacks:
\`\`\`solidity
mapping(uint64 => address) public pendingFlips;

function flip() external payable {
    uint256 fee = entropy.getFeeV2();
    uint64 seq = entropy.requestV2{value: fee}();
    pendingFlips[seq] = msg.sender;
}

function entropyCallback(uint64 seq, address, bytes32 rand) internal override {
    address player = pendingFlips[seq];
    delete pendingFlips[seq];
    // Use rand for player's result
}
\`\`\`

## Troubleshooting

### Callback Never Fires
The most common issue. Check these in order:
1. **Fee too low**: Use \`getFeeV2()\` on-chain, don't hardcode
2. **Callback reverts**: Your \`entropyCallback\` must NEVER revert — if it errors, the keeper cannot invoke it
3. **Gas too low**: Increase gas limit with \`requestV2(gasLimit)\`
4. **Chain delay**: Some chains have longer reveal delays — check chainlist

### Debugging with Entropy Explorer
Use the interactive debugger to inspect request status:
https://entropy-explorer.pyth.network/

### Re-requesting Failed Callbacks
If a callback failed due to gas or logic errors, use \`revealWithCallback()\` to manually re-trigger it after fixing the issue.

### Error Codes Reference
Common on-chain errors:
- \`InsufficientFee\` — Send more native tokens with the request
- \`RevealTooEarly\` — Wait for the reveal delay to pass
- \`InvalidProvider\` — Provider address is incorrect
- \`NoSuchRequest\` — Sequence number doesn't match any pending request

## Deep Dive Pages

For complete documentation, fetch any page as plain markdown:
- https://docs.pyth.network/entropy/generate-random-numbers-evm.mdx — Step-by-step EVM quickstart
- https://docs.pyth.network/entropy/create-your-first-entropy-app.mdx — Full coin flip tutorial
- https://docs.pyth.network/entropy/whats-new-entropyv2.mdx — v2 features and migration from v1
- https://docs.pyth.network/entropy/request-callback-variants.mdx — All requestV2 overloads explained
- https://docs.pyth.network/entropy/protocol-design.mdx — Commit-reveal protocol deep dive
- https://docs.pyth.network/entropy/debug-callback-failures.mdx — Debugging callback issues
- https://docs.pyth.network/entropy/set-custom-gas-limits.mdx — Gas limit configuration
- https://docs.pyth.network/entropy/transform-entropy-results.mdx — Random number transformation
- https://docs.pyth.network/entropy/chainlist.mdx — Contract addresses, fees, reveal delays
- https://docs.pyth.network/entropy/fees.mdx — Fee structure details
- https://docs.pyth.network/entropy/error-codes.mdx — Complete error code reference
- https://docs.pyth.network/entropy/examples.mdx — Code examples collection
`;

export function GET() {
  const content = CONTENT + `\nGenerated on: ${new Date().toISOString()}\n`;
  return new NextResponse(content, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 200,
  });
}
