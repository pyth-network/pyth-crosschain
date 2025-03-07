# Pyth IOTA JS SDK

[Pyth](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency, equities, FX and commodities.
This library allows you to use these real-time prices on the [IOTA network](https://www.iota.org/).

## Installation

### npm

```
$ npm install --save @pythnetwork/pyth-iota-js
```

### Yarn

```
$ yarn add @pythnetwork/pyth-iota-js
```

## Quickstart

Pyth stores prices off-chain to minimize gas fees, which allows us to offer a wider selection of products and faster update times.
See [On-Demand Updates](https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand) for more information about this approach.
Typically, to use Pyth prices on chain,
they must be fetched from an off-chain Hermes instance. The `IotaPriceServiceConnection` class can be used to interact with these services,
providing a way to fetch these prices directly in your code. The following example wraps an existing RPC provider and shows how to obtain
Pyth prices and submit them to the network:

```typescript
const connection = new IotaPriceServiceConnection(
  "https://hermes.pyth.network"
); // See Hermes endpoints section below for other endpoints

const priceIds = [
  // You can find the ids of prices at https://pyth.network/developers/price-feed-ids
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD price id
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD price id
];

// In order to use Pyth prices in your protocol you need to submit the price update data to Pyth contract in your target
// chain. `getPriceUpdateData` creates the update data which can be submitted to your contract.

const priceUpdateData = await connection.getPriceFeedsUpdateData(priceIds);
```

## On-chain prices

### **_Important Note for Integrators_**

Your IOTA Move module **should NOT** have a hard-coded call to `pyth::update_single_price_feed`. In other words, the Iota Pyth `pyth::update_single_price_feed` entry point should never be called by a contract, instead it should be called directly from client code (e.g. Typescript or Rust).

This is because when a IOTA contract is [upgraded](https://docs.iota.org/developer/iota-101/move-overview/package-upgrades/upgrade), the new address is different from the original. If your module has a hard-coded call to `pyth::update_single_price_feed` living at a fixed call-site, it may eventually get bricked due to the way Pyth upgrades are implemented. (We only allows users to interact with the most recent package version for security reasons).

Therefore, you should build a [Iota programmable transaction](https://docs.iota.org/ts-sdk/typescript/transaction-building/basics) that first updates the price by calling `pyth::update_single_price_feed` at the latest call-site from the client-side and then call a function in your contract that invokes `pyth::get_price` on the `PriceInfoObject` to get the recently updated price.
You can use `IotaPythClient` to build such transactions.

### Example

```ts
import { IotaPythClient } from "@pythnetwork/pyth-iota-js";
import { Transaction } from "@iota/iota-sdk/transactions";
import { IotaClient } from "@iota/iota-sdk/client";

const priceUpdateData = await connection.getPriceFeedsUpdateData(priceIds); // see quickstart section


// It is either injected from browser or instantiated in backend via some private key
const wallet: SignerWithProvider = getWallet();
// Get the state ids of the Pyth and Wormhole contracts from
// https://docs.pyth.network/documentation/pythnet-price-feeds/sui
const wormholeStateId = " 0xFILL_ME";
const pythStateId = "0xFILL_ME";

const provider = new IotaClient({ url: "https://fill-iota-endpoint" });
const client = new IotaPythClient(wallet.provider, pythStateId, wormholeStateId);
const tx = new Transaction();
const priceInfoObjectIds = await client.updatePriceFeeds(tx, priceFeedUpdateData, priceIds);

tx.moveCall({
    target: `YOUR_PACKAGE::YOUR_MODULE::use_pyth_for_defi`,
    arguments: [
        ..., // other arguments needed for your contract
        tx.object(pythStateId),
        tx.object(priceInfoObjectIds[0]),
    ],
});

const result = await provider.signAndExecuteTransaction({
  signer: wallet,
  transaction: tx,
  options: {
    showEffects: true,
    showEvents: true,
  },
});
```

Now in your contract you can consume the price by calling `pyth::get_price` or other utility functions on the `PriceInfoObject`.

### CLI Example

[This example](./src/examples/IotaRelay.ts) shows how to update prices on an IOTA network. It does the following:

1. Fetches update data from Hermes for the given price feeds.
2. Calls the Pyth IOTA contract with the update data.

You can run this example with `npm run example-relay`. A full command that updates prices on IOTA testnet looks like:

```bash
export IOTA_KEY=YOUR_PRIV_KEY;
npm run example-relay -- --feed-id "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" \
--price-service "https://hermes.pyth.network" \
--full-node "https://api.testnet.iota.cafe" \
--pyth-state-id "0x68dda579251917b3db28e35c4df495c6e664ccc085ede867a9b773c8ebedc2c1" \
--wormhole-state-id "0x8bc490f69520a97ca1b3de864c96aa2265a0cf5d90f5f3f016b2eddf0cf2af2b"
```

## Off-chain prices

Many applications additionally need to display Pyth prices off-chain, for example, in their frontend application.
The `IotaPriceServiceConnection` provides two different ways to fetch the current Pyth price.
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

## Hermes endpoints

You can find the list of Hermes public endpoints [here](https://docs.pyth.network/documentation/pythnet-price-feeds/hermes#public-endpoints).
