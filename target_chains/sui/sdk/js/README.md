# Pyth Sui JS SDK

[Pyth](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency, equities, FX and commodities. This library allows you to use these real-time prices on the [Sui network](https://sui.io/).

## Installation

### pnpm

```
cd to crosschain root
$ pnpm install
```

## Quickstart

Pyth stores prices off-chain to minimize gas fees, which allows us to offer a wider selection of products and faster update times.
See [On-Demand Updates](https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand) for more information about this approach.
Typically, to use Pyth prices on chain,
they must be fetched from an off-chain Hermes instance. The `SuiPriceServiceConnection` class can be used to interact with these services,
providing a way to fetch these prices directly in your code. The following example wraps an existing RPC provider and shows how to obtain
Pyth prices and submit them to the network:

```typescript
const connection = new SuiPriceServiceConnection(
  "https://hermes-beta.pyth.network"
); // See Hermes endpoints section below for other endpoints

const priceIds = [
  // You can find the ids of prices at https://pyth.network/developers/price-feed-ids#sui-testnet
  "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b", // BTC/USD price id in testnet
  "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6", // ETH/USD price id in testnet
];

// In order to use Pyth prices in your protocol you need to submit the price update data to Pyth contract in your target
// chain. `getPriceUpdateData` creates the update data which can be submitted to your contract.

const priceUpdateData = await connection.getPriceFeedsUpdateData(priceIds);
```

## On-chain prices

### **_Important Note for Integrators_**

Your Sui Move module **should NOT** have a hard-coded call to `pyth::update_single_price_feed`. In other words, the Sui Pyth `pyth::update_single_price_feed` entry point should never be called by a contract, instead it should be called directly from client code (e.g. Typescript or Rust).

This is because when a Sui contract is [upgraded](https://docs.sui.io/build/package-upgrades), the new address is different from the original. If your module has a hard-coded call to `pyth::update_single_price_feed` living at a fixed call-site, it may eventually get bricked due to the way Pyth upgrades are implemented. (We only allows users to interact with the most recent package version for security reasons).

Therefore, you should build a [Sui programmable transaction](https://docs.sui.io/build/prog-trans-ts-sdk) that first updates the price by calling `pyth::update_single_price_feed` at the latest call-site from the client-side and then call a function in your contract that invokes `pyth::get_price` on the `PriceInfoObject` to get the recently updated price.
You can use `SuiPythClient` to build such transactions.

### Example

```ts
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";

const priceUpdateData = await connection.getPriceFeedsUpdateData(priceIds); // see quickstart section


// It is either injected from browser or instantiated in backend via some private key
const wallet: SignerWithProvider = getWallet();
// Get the state ids of the Pyth and Wormhole contracts from
// https://docs.pyth.network/documentation/pythnet-price-feeds/sui
const wormholeStateId = " 0xFILL_ME";
const pythStateId = "0xFILL_ME";

const provider = new SuiClient({ url: "https://fill-sui-endpoint" });
const client = new SuiPythClient(wallet.provider, pythStateId, wormholeStateId);
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

[This example](./src/examples/SuiRelay.ts) shows how to update prices on an Sui network. It does the following:

1. Fetches update data from Hermes for the given price feeds.
2. Calls the Pyth Sui contract with the update data.

In order to run the commands, a SUI private key is needed. The commands expects the key to be in the form of hex. You can use `sui keytool convert` to get the hex version of the key, to be used below, if your private key is in the form "suiprivkey...".

You can run this example with `pnpm turbo --filter @pythnetwork/pyth-sui-js run example-relay` from the root of crosschain. Turbo will automatically build any detected dependencies including local ones, and filter is needed to tell it which sub-package to use (Such as this one). A full command that updates prices on Sui testnet looks like:

```bash
export SUI_KEY=YOUR_PRIV_KEY;
pnpm turbo --filter @pythnetwork/pyth-sui-js run example-relay -- --feed-id "5a035d5440f5c163069af66062bac6c79377bf88396fa27e6067bfca8096d280" \
--price-service "https://hermes-beta.pyth.network" \
--full-node "https://fullnode.testnet.sui.io:443" \
--pyth-state-id "0xd3e79c2c083b934e78b3bd58a490ec6b092561954da6e7322e1e2b3c8abfddc0" \
--wormhole-state-id "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790"
```

## Off-chain prices

Many applications additionally need to display Pyth prices off-chain, for example, in their frontend application.
The `SuiPriceServiceConnection` provides two different ways to fetch the current Pyth price.
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
