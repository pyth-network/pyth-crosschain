# Pyth EVM JS

[Pyth](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency, equities, FX and commodities. This library allows you to use these real-time prices on EVM-based networks.

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

Pyth stores prices off-chain to minimize gas fees, which allows us to offer a wider selection of products and faster update times.
See [On-Demand Updates](https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand) for more information about this approach. In order to use Pyth prices on chain,
they must be fetched from an off-chain price service. The `EvmPriceServiceConnection` class can be used to interact with these services,
providing a way to fetch these prices directly in your code. The following example wraps an existing RPC provider and shows how to obtain
Pyth prices and submit them to the network:

```typescript
const connection = new EvmPriceServiceConnection(
  "https://xc-testnet.pyth.network"
); // See Price Service endpoints section below for other endpoints

const priceIds = [
  // You can find the ids of prices at https://pyth.network/developers/price-feed-ids#pyth-evm-testnet
  "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b", // BTC/USD price id in testnet
  "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6", // ETH/USD price id in testnet
];

// In order to use Pyth prices in your protocol you need to submit the price update data to Pyth contract in your target
// chain. `getPriceFeedsUpdateData` creates the update data which can be submitted to your contract. Then your contract should
// call the Pyth Contract with this data.
const priceUpdateData = await connection.getPriceFeedsUpdateData(priceIds);

// If the user is paying the price update fee, you need to fetch it from the Pyth contract.
// Please refer to https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand#fees for more information.
//
// `pythContract` below is a web3.js contract; if you wish to use ethers, you need to change it accordingly.
// You can find the Pyth interface ABI in @pythnetwork/pyth-sdk-solidity npm package.
const updateFee = await pythContract.methods
  .getUpdateFee(priceUpdateData)
  .call();
// Calling someContract method
// `someContract` below is a web3.js contract; if you wish to use ethers, you need to change it accordingly.
await someContract.methods
  .doSomething(someArg, otherArg, priceUpdateData)
  .send({ value: updateFee });
```

`SomeContract` looks like so:

```solidity
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract SomeContract {
  IPyth pyth;

  constructor(address pythContract) {
    pyth = IPyth(pythContract);
  }

  function doSomething(
    uint someArg,
    string memory otherArg,
    bytes[] calldata priceUpdateData
  ) public payable {
    // Update the prices to be set to the latest values
    uint fee = pyth.getUpdateFee(priceUpdateData);
    pyth.updatePriceFeeds{ value: fee }(priceUpdateData);

    // Doing other things that uses prices
    bytes32 priceId = 0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b;
    PythStructs.Price price = pyth.getPrice(priceId);
  }
}

```

We strongly recommend reading our guide which explains [how to work with Pyth price feeds](https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices).

### Off-chain prices

Many applications additionally need to display Pyth prices off-chain, for example, in their frontend application.
The `EvmPriceServiceConnection` provides two different ways to fetch the current Pyth price.
The code blocks below assume that the `connection` and `priceIds` objects have been initialized as shown above.
The first method is a single-shot query:

```typescript
// `getLatestPriceFeeds` returns a `PriceFeed` for each price id. It contains all information about a price and has
// utility functions to get the current and exponentially-weighted moving average price, and other functionality.
const priceFeeds = await connection.getLatestPriceFeeds(priceIds);
// Get the price if it is not older than 60 seconds from the current time.
console.log(priceFeeds[0].getPriceNoOlderThan(60)); // Price { conf: '1234', expo: -8, price: '12345678' }
// Get the exponentially-weighted moving average price if it is not older than 60 seconds from the current time.
console.log(priceFeeds[1].getEmaPriceNoOlderThan(60));
```

The object also supports a streaming websocket connection that allows you to subscribe to every new price update for a given feed.
This method is useful if you want to show continuously updating real-time prices in your frontend:

```typescript
// Subscribe to the price feeds given by `priceId`. The callback will be invoked every time the requested feed
// gets a price update.
connection.subscribePriceFeedUpdates(priceIds, (priceFeed) => {
  console.log(
    `Received update for ${priceFeed.id}: ${priceFeed.getPriceNoOlderThan(60)}`
  );
});

// When using the subscription, make sure to close the websocket upon termination to finish the process gracefully.
setTimeout(() => {
  connection.closeWebSocket();
}, 60000);
```

### Examples

There are two examples in [examples](./src/examples/).

#### EvmPriceServiceClient

[This example](./src/examples/EvmPriceServiceClient.ts) fetches `PriceFeed` updates using both a HTTP-request API and a streaming websocket API. You can run it with `npm run example-client`. A full command that prints BTC and ETH price feeds, in the testnet network, looks like so:

```bash
npm run example-client -- --endpoint https://xc-testnet.pyth.network --price-ids 0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b 0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6
```

#### EvmRelay

[This example](./src/examples/EvmRelay.ts) shows how to update prices on an EVM network. It does the following:

1. Gets update data to update given price feeds.
2. Calls the pyth contract with the update data.
3. Submits it to the network and prints the txhash if successful.

You can run this example with `npm run example-relay`. A full command that updates BTC and ETH prices on the BNB Chain testnet network looks like so:

```bash
npm run example-relay -- \
  --network "https://data-seed-prebsc-1-s1.binance.org:8545" \
  --pyth-contract "0xd7308b14BF4008e7C7196eC35610B1427C5702EA"\
  --mnemonic "my good mnemonic" \
  --endpoint https://xc-testnet.pyth.network \
  --price-ids \
    "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b" \
    "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6"
```

## Price Service endpoints

Public endpoints for the Price Service are provided for both mainnet and testnet. These can be used regardless of which network you deploy your own contracts to as long as it is a Pyth supported network. For example, you can use the testnet Price Service whether you are deploying your contract to the BNB or Polygon testnet.

| network | url                             |
| ------- | ------------------------------- |
| mainnet | https://xc-mainnet.pyth.network |
| testnet | https://xc-testnet.pyth.network |
