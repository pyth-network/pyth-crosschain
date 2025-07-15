# Pyth EVM JS

[Pyth](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency,
equities, FX and commodities. This library allows you to use these real-time prices on EVM-based networks.

## Installation

### npm

```
$ npm install --save @pythnetwork/pyth-evm-js
```

### Yarn

```
$ yarn add @pythnetwork/pyth-evm-js
```

## Quickstart

### Filling Pyth Data for Transactions

The `fillPythUpdate` function helps you automatically determine what Pyth price updates are needed for a transaction and creates the necessary update call.
This function uses the `trace_callMany` method by default but can be used with `debug_traceCall` and a bundler as well. See the example below for more information.

```typescript
import { fillPythUpdate, multicall3Bundler, CallRequest } from "@pythnetwork/pyth-evm-js";
import { createPublicClient, http } from "viem";
import { optimismSepolia } from "viem/chains";

const PYTH_CONTRACT_OP_SEPOLIA = "0x0708325268df9f66270f1401206434524814508b"
const HERMES_ENDPOINT = "https://hermes.pyth.network"

const client = createPublicClient({
    chain: optimismSepolia,
    transport: http("YOUR_RPC_ENDPOINT"),
});

const call: CallRequest = {
    to: "0x3252c2F7962689fA17f892C52555613f36056f22",
    data: "0xd09de08a", // Your transaction calldata
    from: "0x78357316239040e19fC823372cC179ca75e64b81",
};

// Fill Pyth update data using "trace_callMany"
const pythUpdate = await fillPythUpdate(
    client,
    call,
    PYTH_CONTRACT_OP_SEPOLIA,
    HERMES_ENDPOINT,
    {
        method: "trace_callMany",
        maxIter: 5,
    },
);

// Fill Pyth update data using "debug_traceCall"
const _pythUpdateWithDebugTraceCall = await fillPythUpdate(
    client,
    call,
    PYTH_CONTRACT_OP_SEPOLIA,
    HERMES_ENDPOINT,
    {
        method: "debug_traceCall",
        bundler: multicall3Bundler, // or any function that takes a PythUpdate and a CallRequest and produces a CallRequest
        maxIter: 5,
    },
);

if (pythUpdate) {
    console.log("Pyth update needed:", pythUpdate);
    // Bundle the calls together, or pass the pythUpdate.updateData to your contract.
} else {
    console.log("No Pyth data needed for this transaction");
}
```
