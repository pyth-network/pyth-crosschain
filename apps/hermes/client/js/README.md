# Hermes Client

[Pyth Network](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency, equities, FX and commodities.
These prices are available either via HTTP or Streaming from [Hermes](/apps/hermes).
This library is a client for interacting with Hermes, allowing your application to consume Pyth real-time prices in on- and off-chain Javascript/Typescript applications.

## Installation

### npm

```
$ npm install --save @pythnetwork/hermes-client
```

### Yarn

```
$ yarn add @pythnetwork/hermes-client
```

## Quickstart

Typical usage of the connection is along the following lines:

```typescript
const connection = new HermesClient("https://hermes.pyth.network", {}); // See Hermes endpoints section below for other endpoints

const priceIds = [
  // You can find the ids of prices at https://pyth.network/developers/price-feed-ids
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD price id
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD price id
];

// Get price feeds
const priceFeeds = await connection.getPriceFeeds({
  query: "btc",
  filter: "crypto",
});
console.log(priceFeeds);

// Latest price updates
const priceUpdates = await connection.getLatestPriceUpdates(priceIds);
console.log(priceUpdates);
```

`HermesClient` also allows subscribing to real-time price updates over a Server-Sent Events (SSE) connection:

```typescript
// Streaming price updates
const eventSource = await connection.getPriceUpdatesStream(priceIds);

eventSource.onmessage = (event) => {
  console.log("Received price update:", event.data);
};

eventSource.onerror = (error) => {
  console.error("Error receiving updates:", error);
  eventSource.close();
};

await sleep(5000);

// To stop listening to the updates, you can call eventSource.close();
console.log("Closing event source.");
eventSource.close();
```

### On-chain Applications

On-chain applications will need to submit the price updates returned by Hermes to the Pyth contract on their blockchain.
By default, these updates are returned as binary data and is serialized as either a base64 string or a hex string depending on the chosen encoding. This binary data will need to be submitted to the Pyth contract.

### Examples

The [HermesClient](./src/examples/HermesClient.ts) example demonstrates both the
examples above. To run the example:

1. Clone [the Pyth monorepo](https://github.com/pyth-network/pyth-crosschain)
2. In the root of the monorepo, run `pnpm example:hermes-client -- <args>`. For
   example, to print BTC and ETH price feeds in the testnet network, run:

```bash
pnpm example:hermes-client -- \
  --endpoint https://hermes.pyth.network \
  --price-ids \
    0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43 \
    0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
```

## Hermes endpoints

Pyth offers a free public endpoint at [https://hermes.pyth.network](https://hermes.pyth.network). However, it is
recommended to obtain a private endpoint from one of the Hermes RPC providers for more reliability. You can find more
information about Hermes RPC providers
[here](https://docs.pyth.network/documentation/pythnet-price-feeds/hermes#public-endpoint).
