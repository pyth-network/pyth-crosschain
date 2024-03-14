# Pyth Solana Receiver JS SDK

This is a Javascript SDK to interact with the Pyth Solana Receiver contract whose code lives [here](/target_chains/solana).

## Pull model

The Pyth Solana Receiver allows users to consume Pyth price updates on a pull basis. This means that the user is responsible for submitting the price data on-chain whenever they want to interact with an app that requires a price update.

Price updates get posted into price update accounts, owned by the Receiver contract. Once an update has been posted to a price update account, it can be used by anyone by simply passing the price update account as one of the accounts in a Solana instruction.
Price update accounts can be closed by whoever wrote them to recover the rent.

## Example use

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
  await transactionBuilder.getVersionedTransactions({
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
