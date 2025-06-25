# Transaction Filler

The Transaction Filler is a utility that automatically detects Pyth price feed usage in Ethereum transactions and bundles them with the necessary price updates.

## Features

- Automatically detects Pyth `getPrice*` method calls using transaction tracing
- Fetches latest price updates from Hermes price service
- Bundles price updates with original transaction using multicall
- Iterative approach to handle nested price feed dependencies
- Supports both `trace_call` and `debug_traceCall` methods

## Usage

```typescript
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { fillTransactionWithPythData } from "@pythnetwork/pyth-evm-js";

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.drpc.org"),
});

const config = {
  pythContractAddress: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  priceServiceEndpoint: "https://hermes.pyth.network",
  viemClient: client,
};

const transaction = {
  to: "0xe0a80d35bB6618CBA260120b279d357978c42BCE",
  data: "0xa824bf67000000000000000000000000c1d023141ad6935f81e5286e577768b75c9ff8e90000000000000000000000000000000000000000000000000000000000000001",
};

const result = await fillTransactionWithPythData(config, transaction);
console.log("Detected price feeds:", result.detectedPriceFeeds);
console.log("Final transaction:", result.transaction);
```

## Detected Methods

The following Pyth methods are automatically detected:
- `getPrice(bytes32 id)`
- `getPriceUnsafe(bytes32 id)`
- `getPriceNoOlderThan(bytes32 id, uint256 age)`
- `getEmaPrice(bytes32 id)`
- `getEmaPriceUnsafe(bytes32 id)`
- `getEmaPriceNoOlderThan(bytes32 id, uint256 age)`

## Configuration

- `pythContractAddress`: Address of the Pyth contract on the target chain
- `priceServiceEndpoint`: URL of the Hermes price service
- `viemClient`: Viem public client for blockchain interactions
- `maxIterations`: Maximum number of iterations for detecting nested dependencies (default: 5)
