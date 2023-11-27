# Price Service Client

[Pyth Network](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency, equities, FX and commodities.
These prices are available either via HTTP or WebSocket from [Hermes](https://github.com/pyth-network/pyth-crosschain/tree/main/hermes).
This library is a client for interacting with Hermes, allowing your application to consume Pyth real-time prices in on- and off-chain Javascript/Typescript applications.

## Installation

### npm

```
$ npm install --save @pythnetwork/price-service-client
```

### Yarn

```
$ yarn add @pythnetwork/price-service-client
```

## Quickstart

Typical usage of the connection is along the following lines:

```typescript
const connection = new PriceServiceConnection("https://hermes.pyth.network", {
  priceFeedRequestConfig: {
    // Provide this option to retrieve signed price updates for on-chain contracts.
    // Ignore this option for off-chain use.
    binary: true,
  },
}); // See Hermes endpoints section below for other endpoints

const priceIds = [
  // You can find the ids of prices at https://pyth.network/developers/price-feed-ids
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD price id
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD price id
];

// Get the latest values of the price feeds as json objects.
// If you set `binary: true` above, then this method also returns signed price updates for the on-chain Pyth contract.
const currentPrices = await connection.getLatestPriceFeeds(priceIds);

// You can also call this function to get price updates for the on-chain contract directly.
const priceUpdateData = await connection.getPriceFeedsUpdateData(priceIds);
```

`PriceServiceConnection` also allows subscribing to real-time price updates over a websocket connection:

```typescript
connection.subscribePriceFeedUpdates(priceIds, (priceFeed) => {
  // priceFeed here is the same as returned by getLatestPriceFeeds above.
  // It will include signed price updates if the binary option was provided to the connection constructor.
  console.log(
    `Received update for ${priceFeed.id}: ${priceFeed.getPriceNoOlderThan(60)}`
  );
});

// When using the subscription, make sure to close the websocket upon termination to finish the process gracefully.
setTimeout(() => {
  connection.closeWebSocket();
}, 60000);
```

### On-chain Applications

On-chain applications will need to submit the price updates returned by Hermes to the Pyth contract on their blockchain.
These applications should pass the `binary: true` option to the constructor as shown above, to ensure that all methods on `PriceServiceConnection` return the required information.
This option will add a `vaa` field to `PriceFeed` that represents a signed price update.
The `vaa` is a binary blob serialized as a base64 string.
Depending on the blockchain, you may need to reformat this into hex or another format before submitting it to the Pyth contract.

### Examples

The [PriceServiceClient](./src/examples/PriceServiceClient.ts) example demonstrates both the HTTP and websocket APIs described above.
You can run it with `npm run example`.
A full command that prints BTC and ETH price feeds, in the testnet network, looks like so:

```bash
npm run example -- \
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
