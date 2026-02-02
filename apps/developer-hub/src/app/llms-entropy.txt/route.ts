import { NextResponse } from "next/server";

import { getLLMTextByPaths } from "../../lib/get-llm-text";

export const revalidate = false;

const STATIC_HEADER = `# Pyth Entropy - Complete Documentation

> Secure, verifiable random number generation for blockchain applications.
> This file contains complete Entropy documentation. No other files need to be fetched.

Pyth Entropy is an on-chain RNG designed for developers who need fair, unbiased, and cryptographically secure randomness. Built on a commit-reveal protocol.

## Key Features
- **Trustless & verifiable** - commit-reveal protocol ensures fairness
- **Low-latency** - randomness within a few blocks
- **Easy to use** - get started in minutes
- **Cost-efficient** - designed for production scale
- **Native gas fees** - pay with chain native token

## Quick Start (Solidity)

\`\`\`solidity
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

contract CoinFlip is IEntropyConsumer {
    IEntropy entropy;
    address entropyProvider;

    constructor(address _entropy, address _provider) {
        entropy = IEntropy(_entropy);
        entropyProvider = _provider;
    }

    function flip(bytes32 userRandomNumber) external payable {
        uint256 fee = entropy.getFee(entropyProvider);
        uint64 sequenceNumber = entropy.requestWithCallback{value: fee}(
            entropyProvider,
            userRandomNumber
        );
    }

    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) internal override {
        // Use randomNumber for your game logic
        bool isHeads = uint256(randomNumber) % 2 == 0;
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }
}
\`\`\`

## Quick Start (TypeScript)

\`\`\`typescript
import { EntropyClient } from "@pythnetwork/entropy-sdk-solidity";

// Request randomness
const client = new EntropyClient(provider, entropyContractAddress);
const fee = await client.getFee();
const tx = await client.requestWithCallback(providerAddress, userRandomNumber, { value: fee });
\`\`\`

## Entropy Contracts

Find contract addresses for all supported chains:
https://docs.pyth.network/entropy/chainlist

## Fortuna API (Random Number Provider)
- Base URL: https://fortuna.pyth.network
- OpenAPI spec: https://fortuna.pyth.network/docs

## SDKs
- Solidity: @pythnetwork/entropy-sdk-solidity
- TypeScript: @pythnetwork/entropy-ts

## Use Cases
- Gaming: Fair dice rolls, card shuffling, loot drops
- NFTs: Random trait assignment, fair minting
- Lotteries: Verifiable winner selection
- DeFi: Random liquidation selection

---

## Detailed Documentation

`;

export async function GET() {
  const pathPrefixes = ["/entropy", "/api-reference/entropy"];

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
