# Price Service Client

[Pyth Network](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency, equities, FX and commodities.
These prices are available either via HTTP or WebSocket from Pyth's [price service](https://github.com/pyth-network/pyth-crosschain/tree/main/price_service/server).
This library is a client for interacting with the price service, allowing your application to consume Pyth real-time prices in on- and off-chain Javascript/Typescript applications.

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
const connection = new PriceServiceConnection(
  "https://xc-testnet.pyth.network",
  {
    priceFeedRequestConfig: {
      // Provide this option to retrieve signed price updates for on-chain contracts.
      // Ignore this option for off-chain use.
      binary: true,
    },
  }
); // See Price Service endpoints section below for other endpoints

const priceIds = [
  // You can find the ids of prices at https://pyth.network/developers/price-feed-ids#pyth-evm-testnet
  "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b", // BTC/USD price id in testnet
  "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6", // ETH/USD price id in testnet
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

On-chain applications will need to submit the price updates returned by the price service to the Pyth contract on their blockchain.
These applications should pass the `binary: true` option to the constructor as shown above, to ensure that all methods on `PriceServiceConnection` return the required information.
This option will add a `vaa` field to `PriceFeed` that represents a signed price update.
The `vaa` is a binary blob serialized as a base64 string.
Depending on the blockchain, you may need to reformat this into hex or another format before submitting it to the Pyth contract.

### Examples

The [PriceServiceClient](./src/examples/PriceServiceClient.ts) example demonstrates both the HTTP and websocket APIs described above.
You can run it with `npm run example`.
A full command that prints BTC and ETH price feeds, in the testnet network, looks like so:

```bash
npm run example -- --endpoint https://xc-testnet.pyth.network --price-ids 0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b 0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6
```

## Price Service endpoints

Public endpoints for the Price Service are provided for both mainnet and testnet. These can be used regardless of which network you deploy your own contracts to as long as it is a Pyth supported network. For example, you can use the testnet Price Service whether you are deploying your contract to the BNB or Polygon testnet.

| network | url                             |
| ------- | ------------------------------- |
| mainnet | https://xc-mainnet.pyth.network |
| testnet | https://xc-testnet.pyth.network |
