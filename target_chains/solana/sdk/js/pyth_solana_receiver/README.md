# Pyth Solana Receiver JS SDK

This is a Javascript SDK to interact with the Pyth Solana Receiver contract whose code lives [here](/target_chains/solana).

It is available on [npm](https://www.npmjs.com/package/@pythnetwork/pyth-solana-receiver).

## Pull model

The Pyth Solana Receiver allows users to consume Pyth price updates on a pull basis. This means that the user is responsible for submitting the price data on-chain whenever they want to interact with an app that requires a price update.

Price updates get posted into price update accounts, owned by the Receiver contract. Once an update has been posted to a price update account, it can be used by anyone by simply passing the price update account as one of the accounts in a Solana instruction.
Price update accounts can be closed by whoever wrote them to recover the rent.

## Price update accounts vs price feed accounts

In the pure pull model, each price update gets posted to an ephemeral account that can be closed after being consumed to reclaim rent. The SDK exposes this functionality with `addPostPriceUpdates` and `addPostPartiallyVerifiedPriceUpdates`.

Another way of consuming price updates is via price feed accounts. Price feed accounts are a special type of price update accounts with the following properties:

- They have a static address that can be derived from a feed id and a shard id (the shard id allows multiple sets of price feed accounts to exist) (the address can be derived using `getPriceFeedAccountAddress`)
- They always contain a price update for the feed id their address is derived from
- The update they contain can only be replaced by a more recent update

The SDK also allows updating price feed accounts with a more recent update via `addUpdatePriceFeed`.

## Push model

Combining price feed accounts with a scheduler service that periodically updates the price feed account allows using such price feed account as a push oracle.
Assuming the scheduler is running, a downstream app can consume the price updates by simply passing the price feed account as an account in a Solana instruction without needing to worry about updating the price feed account.

Check out the [Price Pusher](../../../../../../../price_pusher/) for an example of a price scheduler.

## Example use (pull model)

```ts
import { Connection, PublicKey } from "@solana/web3.js";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { MyFirstPythApp, IDL } from "./idl/my_first_pyth_app";

const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const ETH_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const priceServiceConnection = new PriceServiceConnection(
  "https://hermes.pyth.network/",
  { priceFeedRequestConfig: { binary: true } }
);
const priceUpdateData = await priceServiceConnection.getLatestVaas([
  SOL_PRICE_FEED_ID,
  ETH_PRICE_FEED_ID,
]); // Fetch off-chain price update data

const myFirstPythApp = new Program<MyFirstPythApp>(
  IDL as MyFirstPythApp,
  MY_FIRST_PYTH_APP_PROGRAM_ID,
  {}
);

const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
await transactionBuilder.addPostPriceUpdates(priceUpdateData);
await transactionBuilder.addPriceConsumerInstructions(
  async (
    getPriceUpdateAccount: (priceFeedId: string) => PublicKey
  ): Promise<InstructionWithEphemeralSigners[]> => {
    return [
      {
        instruction: await myFirstPythApp.methods
          .consume()
          .accounts({
            solPriceUpdate: getPriceUpdateAccount(SOL_PRICE_FEED_ID),
            ethPriceUpdate: getPriceUpdateAccount(ETH_PRICE_FEED_ID),
          })
          .instruction(),
        signers: [],
      },
    ];
  }
);
await pythSolanaReceiver.provider.sendAll(
  await transactionBuilder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: 1000000,
  })
);
```

Alternatively you can use the instruction builder methods from `PythSolanaReceiver` :

```ts
import { PublicKey } from "@solana/web3.js";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { MyFirstPythApp, IDL } from "./idl/my_first_pyth_app";

const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const ETH_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const priceServiceConnection = new PriceServiceConnection(
  "https://hermes.pyth.network/",
  { priceFeedRequestConfig: { binary: true } }
);
const priceUpdateData = await priceServiceConnection.getLatestVaas([
  SOL_PRICE_FEED_ID,
  ETH_PRICE_FEED_ID,
]); // Fetch off-chain price update data

const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });
const { postInstructions, closeInstructions, priceFeedIdToPriceUpdateAccount } =
  await pythSolanaReceiver.buildPostPriceUpdateInstructions(priceUpdateData); // Get instructions to post the price update data and to close the accounts later

const myFirstPythApp = new Program<MyFirstPythApp>(
  IDL as MyFirstPythApp,
  MY_FIRST_PYTH_APP_PROGRAM_ID,
  {}
);
const consumerInstruction: InstructionWithEphemeralSigners = {
  instruction: await myFirstPythApp.methods
    .consume()
    .accounts({
      solPriceUpdate: priceFeedIdToPriceUpdateAccount[SOL_PRICE_FEED_ID],
      ethPriceUpdate: priceFeedIdToPriceUpdateAccount[ETH_PRICE_FEED_ID],
    })
    .instruction(),
  signers: [],
};

const transactions = pythSolanaReceiver.batchIntoVersionedTransactions(
  [...postInstructions, consumerInstruction, ...closeInstructions],
  { computeUnitPriceMicroLamports: 1000000 }
); // Put all the instructions together
await pythSolanaReceiver.provider.sendAll(transactions);
```
