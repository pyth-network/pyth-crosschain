# Pyth Starknet JS

[Pyth](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency, equities, FX and commodities. This library allows you to use these real-time prices on Starknet networks.

## Installation

### npm

```
$ npm install --save @pythnetwork/pyth-starknet-js
```

### Yarn

```
$ yarn add @pythnetwork/pyth-starknet-js
```

## Quickstart

This library is intended to be used in combination with `price-service-client` and `starknet-js`.

```
$ npm install --save starknet @pythnetwork/price-service-client
```

or

```
$ yarn add starknet @pythnetwork/price-service-client
```

Pyth stores prices off-chain to minimize gas fees, which allows us to offer a wider selection of products and faster update times.
See [On-Demand Updates](https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand) for more information about this approach.
To use Pyth prices on chain,
they must be fetched from a Hermes instance. The `PriceServiceConnection` class from Pyth's `price-service-client` library can be used to interact with Hermes,
providing a way to fetch these prices directly in your code.
In order to use Pyth prices in your protocol you need to submit the price update data to Pyth contract in your target
chain. The following example shows how to obtain
Pyth prices and submit them to a Starknet network:

```typescript
import { Account, Contract, RpcProvider, shortString } from "starknet";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import {
  ByteBuffer,
  ERC20_ABI,
  ETH_TOKEN_ADDRESS,
  PYTH_ABI,
  PYTH_CONTRACT_ADDRESS_SEPOLIA,
} from "@pythnetwork/pyth-starknet-js";

// Create a provider for interacting with Starknet RPC.
const provider = new RpcProvider({
  nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_6",
});

// Create a `Contract` instance to interact with a fee token contract on Starknet
// (you can use either STRK or ETH to pay fees, but using STRK is recommended).
const strkErc0Contract = new Contract(ERC20_ABI, STRK_TOKEN_ADDRESS, provider);

// Create a `Contract` instance to interact with the Pyth contract on Starknet.
const pythContract = new Contract(
  PYTH_ABI,
  PYTH_CONTRACT_ADDRESS_SEPOLIA,
  provider
);

// Import your account data from environment variables.
// You'll need to set them before running the code.
const privateKey0 = process.env.ACCOUNT_PRIVATE_KEY;
if (privateKey0 === undefined) {
  throw new Error("missing ACCOUNT_PRIVATE_KEY");
}
const account0Address = process.env.ACCOUNT_ADDRESS;
if (account0Address === undefined) {
  throw new Error("missing ACCOUNT_ADDRESS");
}
const account0 = new Account(provider, account0Address, privateKey0);

// Create a client for pulling price updates from Hermes.
const connection = new PriceServiceConnection("https://hermes.pyth.network", {
  priceFeedRequestConfig: {
    // Provide this option to retrieve signed price updates for on-chain contracts.
    // Ignore this option for off-chain use.
    binary: true,
  },
});

const priceFeedId =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"; // ETH/USD

// Convert the price update to Starknet format.
const pythUpdate = ByteBuffer.fromHex(currentPrices[0].vaa);

// Query the amount of fee required by Pyth.
const fee = await pythContract.get_update_fee(
  pythUpdate,
  strkErc0Contract.address
);

// Approve fee withdrawal.
strkErc0Contract.connect(account0);
let tx = await strkErc0Contract.approve(pythContract.address, fee);
await provider.waitForTransaction(tx.transaction_hash);

// Create a transaction and submit to your contract using the price update data.
pythContract.connect(account0);
tx = await pythContract.update_price_feeds(pythUpdate);
await provider.waitForTransaction(tx.transaction_hash);
console.log("transaction confirmed:", tx.transaction_hash);
```

We strongly recommend reading our guide which explains [how to work with Pyth price feeds](https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices).
