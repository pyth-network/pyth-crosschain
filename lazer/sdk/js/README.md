# Pyth Lazer JavaScript SDK

A JavaScript/TypeScript SDK for connecting to the Pyth Lazer service, supporting both Node and browser environments.


## Quick Start
Install with:
```sh
npm install @pythnetwork/pyth-lazer-sdk
```

Connect to Lazer and process the messages:
```javascript
import { PythLazerClient } from '@pythnetwork/pyth-lazer-sdk';

const client = await PythLazerClient.create({
  urls: ['wss://your-lazer-endpoint/v1/stream'],
  token: 'your-access-token',
  numConnections: 3
});

// Register an event handler for each price update message.
client.addMessageListener((message) => {
  console.log('Received:', message);
});

// Subscribe to a feed. You can call subscribe() multiple times. 
client.subscribe({
  type: "subscribe",
  subscriptionId: 1,
  priceFeedIds: [1, 2],
  properties: ["price"],
  formats: ["solana"],
  deliveryFormat: "binary",
  channel: "fixed_rate@200ms",
  parsed: false,
  jsonBinaryEncoding: "base64",
});
```

For a full demo, run the example in `examples/index.ts` with:
```
pnpm run example
```
### Build locally

Build ESM and CJS packages with:

```sh
pnpm turbo build -F @pythnetwork/pyth-lazer-sdk
```

## API Reference

For detailed API documentation, see the [TypeDoc documentation](docs/typedoc/).

## Contributing & Development

See [contributing.md](docs/contributing/contributing.md) for information on how to develop or contribute to this project!
