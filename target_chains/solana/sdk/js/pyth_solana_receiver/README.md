# Pyth Solana Receiver JS SDK

[@pythnetwork/pyth-solana-receiver](https://www.npmjs.com/package/@pythnetwork/pyth-solana-receiver) is a Typescript SDK for interacting with the Pyth Solana Receiver contract.
The SDK enables users to construct transactions that post Pyth price updates to the Solana blockchain and use them in downstream applications.

The code for the underlying Pyth Solana Receiver program lives [here](/target_chains/solana).

## Installation

You can install the package using your favorite typescript version manager

**NPM:** `npm install @pythnetwork/pyth-solana-receiver`

**Yarn:** `yarn add @pythnetwork/pyth-solana-receiver`

## Preliminaries

### Accessing Pyth Prices

This SDK is designed to be used in combination with a source of Pyth pricing data.
There are two different sources of pricing data that users can choose from.

- [Hermes](https://docs.pyth.network/price-feeds/pythnet-price-feeds/hermes) is a webservice that provides HTTP and websocket endpoints for retrieving real-time Pyth prices.
  The example code below uses the public Hermes instance hosted by the Pyth Data Association at `https://hermes.pyth.network/`.
  Hermes is also available from several infrastructure providers [listed here](https://docs.pyth.network/price-feeds/api-instances-and-providers/hermes).
  The [Price Service Client](https://github.com/pyth-network/pyth-crosschain/tree/main/price_service/client/js) can be used to access Hermes prices in a convenient way.
- [Benchmarks](https://docs.pyth.network/benchmarks) is a webservice that provides HTTP endpoints for accessing historical Pyth prices.
  This service can be used for applications that require prices from specific times in the past.

Both of these services return Pyth price updates, which are binary blobs of signed and timestamped prices.
This SDK enables users to post price updates to the Solana blockchain, verify their validity, and consume them in downstream Solana applications.

### Price Feed IDs

Pyth identifies each pair of assets (e.g., BTC/USD) with a unique price feed id.
The price feed id is a UUID written as a hexadecimal string.
In order to get the price for a specific pair of assets, you will need its corresponding price feed id.
You can look up all available price feed ids [here](https://pyth.network/developers/price-feed-ids).

### Pyth Solana Receiver

The Pyth Solana Receiver provides two different methods for posting and using price updates.

First, a price update can be written to a **_price update account_**.
Once the account has been written, other programs can read the Pyth price from the account by simply including it in their instruction.
Price update accounts are ephemeral: they have an owner who can overwrite their contents or close the account.
This method for using Pyth prices is a good fit for applications that need to use prices at specific timestamps (e.g., to settle a trade at a time).

Second, a price update can be written to a **_price feed account_**.
A price feed account is designed to work similarly to a Pyth price feed -- it holds a sequence of price updates that move forward in time.
Applications can therefore store the address of a price feed account and read its contents whenever they need a recent price for the feed.
Price feed accounts have a fixed address derived from the feed id and a shard id.
The shard id allows different applications to use different accounts for the same feed, thereby reducing the impact of solana congestion.
This method of using Pyth prices is a good fit for applications that always want to use the most recent price.
Additionally, the [Price Scheduler](../../../../../../../price_pusher/) can be used to continuously write fresh updates to a price feed account, freeing applications from worrying about writing their own updates.

This SDK provides methods for working with both types of accounts.

## Usage

The `PythSolanaReceiver` class is the main entrypoint for the SDK.
Instantiate it with a Solana web3 `Connection` and anchor `Wallet`:

```typescript
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const wallet = new Wallet(
  Keypair.fromSecretKey(/* <insert private key here> */)
);
const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });
```

### Post a price update

Post an update to an ephemeral price update account:

```ts
// Fetch this from hermes or benchmarks. See Preliminaries section above for more info.
const priceUpdateData =
  "UE5BVQEAAAADuAEAAAADDQExWGp7w3s3zDxhkNYnzcK2WalKT3uSQqUwetvCf4PgbFzjCdiowrp8Bq8HO+Q+7MHSuQ0BKS3r6attJvmkVbgFAQJlCXsGZdtF88zjeB6sUBcmpuu/J6Ci7tgHiM6hy81rBD5AcU2AQUnYaHvwkzhQsrme4S3SI/F9fZrjMGrPn2jlAQMWvFXRTa/Ga3Kdur06PgxRk2NiIb/RJ+iwXOb1OBljXCqWdew8BTbtVtJSPxb390O/HVzp1L4m3Lw/645pyattAAaKagQCRrWUZvqDhgRGLRqo0o3AWQJ46JD6AdgG/blL115vvembP/F7AjOuMLrjAWS1SgzJMYd9UbblxWkovS2EAQcx9kqzys5E5cRGXjYxD8WRyTb6G7e6g5eGKIX8cT4UHS72fqrawE+gmn0BWQciThOnSEaP8C/4JWB4qBqZPxMMAQid0Yd8BQNsOvdNNqtE7ETYzqnDKFIN8OHxks6ej2cqXUs605TB+AOZiBtogillICrXBo4PyQuRCacsTjan/NhCAQqdmFKys/qTKCujOWfRfvHSfPNHh2cqDCd8TetgZhj2qXP5Bzah3yoL8mHc1gM62FyRgGPgbjlrsL3f2WPn8W9FAAu0G27GuaEhu6WMqj2LC1M/K6JPENtxLoB+tB9Vhpz6ygAp/Um3W2O6ajKl2H3eXpBNW0VWC80U4T40oHFJWrC4AAwn1Q5XbrxUz5MwqmGRKYlHyNy6XQcG+ZXdhY4JcxU8xB70oLKmVoyLPWUqfquAt23FsaIRiD58vOFAQ/Z+6tr+AQ4icUr89Bdc5QaqzIeCzPUZ7vtXY1P+tOo0uCWdZSRowFq4UCrG+r3gNZlekB/qfcVOI+8MkiZ9S34p0o1JvbpmARB0A/MZSnLRQ3HsFQR0fKtIGhUmP5Teu6B5EG6drvoIFkxunm7a2wVz6iOMPsytvwZwN+0YoC+ReMVTiNAQGxUtARE4/5h2ujquF40DGcoh6/oevKqo2t5qaCpSQ95YvRdCaz7Sl/cZlRsXobmYkuOIk1ENhqmuu4EbG/OK5XeH/2r+ARJgNMjScOHWIbWgTL0xPz2uXGXiDKgkkp7H3InHlM14Ah7qi6yvBYrFmi6DlWhRX+cou4hrqUngyk3TmXXaEsZwAWYQC40AAAAAABrhAfrtrFhR4yubI7X5QRqMK6xKrj7U3XuBHdGnLqSqcQAAAAAC5oR+AUFVV1YAAAAAAAfwdTcAACcQgQ9gmOFJJ6Q9Kc944m+Ad3if+XQCAFUA7w2Lb9os66QdoV1AldHaOSoNL47Qxse8D0z6yMKAtW0AAAAEEnsirAAAAAABBHwT////+AAAAABmEAuNAAAAAGYQC4wAAAAECs5k8AAAAAAA9mHKCoc8xlhwoXfu/sbF3G+SM6vmsaW/kremZS23frVwnt9lUw0F4iILSQxHJXg0en93zIjd2hzhbkb6g6pmxaso8ZcBbxO26bQT21ofP2RlJSREqlL/DcmSOJhH9QTVh9wa8YYqSg1+iE+ikKXnzKSgrDke2U1vl9i2AyrXFMrad6iAlAqIDsqW+qZPX5APSvsdas5AE6KoqhrJxgHXY4GtQZxKKvEQs5EPj/wefL0vgTndN6qkAZ9KPuLVL8TCEfZgKdCNOBGqCer8AFUA/2FJGpMREt3xvYFHzRtkE3X3n1glEm1mVICHRjT9Cs4AAABMntCNVwAAAAANC1wx////+AAAAABmEAuNAAAAAGYQC4wAAABMRtENIAAAAAARjpacCqW6MiwuuCTN37nDR9bes6eLYG8IG4MPoSLbarS61bbZ0MR2iLFPUOIDhdYM4b4LG0+l/tt8LJaCtmi5TrICKPfoRdBRgMbQTR1Xkn+oJEQqXe3kH/IIJ6Yl+seCumnf9Wtw85dJ2m3aGx4zXn12Pwz95hE9nyEnmCrXFMrad6iAlAqIDsqW+qZPX5APSvsdas5AE6KoqhrJxgHXY4GtQZxKKvEQs5EPj/wefL0vgTndN6qkAZ9KPuLVL8TCEfZgKdCNOBGqCer8";

// Pass `closeUpdateAccounts: true` to the transaction builder constructor to automatically close the
// price update accounts at the end of the sequence of transactions.
const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
  closeUpdateAccounts: false,
});
await transactionBuilder.addPostPriceUpdates(priceUpdateData);

await transactionBuilder.addPriceConsumerInstructions(
  async (
    getPriceUpdateAccount: (priceFeedId: string) => PublicKey
  ): Promise<InstructionWithEphemeralSigners[]> => {
    // Generate instructions here that use the price updates posted above.
    // getPriceUpdateAccount(<price feed id>) will give you the account for each price update.
    return [];
  }
);

// Send the instructions in the builder in 1 or more transactions.
// The builder will pack the instructions into transactions automatically.
await pythSolanaReceiver.provider.sendAll(
  await transactionBuilder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: 100000,
  })
);
```

The code snippet above will post every price update in `priceUpdateData` to a new ephemeral account.

See `examples/post_price_update.ts` for a runnable example of posting a price update.

### Update a price feed account

Update the price feed account for shard id 1:

```typescript
// Fetch this from hermes or benchmarks. See Preliminaries section above for more info.
const priceUpdateData =
  "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";

const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
// Update the price feed accounts for the feed ids in priceUpdateData and shard id 1
await transactionBuilder.addUpdatePriceFeed(priceUpdateData, 1);

await transactionBuilder.addPriceConsumerInstructions(
  async (
    getPriceUpdateAccount: (priceFeedId: string) => PublicKey
  ): Promise<InstructionWithEphemeralSigners[]> => {
    // Generate instructions here that use the price updates posted above.
    // getPriceUpdateAccount(<price feed id>) will give you the account for each price update.
    return [];
  }
);

// Send the instructions in the builder in 1 or more transactions.
// The builder will pack the instructions into transactions automatically.
await pythSolanaReceiver.provider.sendAll(
  await transactionBuilder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: 100000,
  })
);
```

The code above will update the price feed accounts for the feeds in `priceUpdateData` (in this example, SOL/USD and ETH/USD).
The address of the price feed accounts can be derived automatically from the feed id and the shard id:

```typescript
const solUsdPriceFeedAccount = pythSolanaReceiver
  .getPriceFeedAccountAddress(1, SOL_PRICE_FEED_ID)
  .toBase58();
```

Note that the example above uses a shard id of 1.
Changing the shard id to a different value will give you a different account address.

See `examples/update_price_feed.ts` for a runnable example of updating a price feed.

### Partially verified price updates

Price updates are relatively large and can take multiple transactions to post on the blockchain.
You can reduce the size of the transaction payload by using `addPostPartiallyVerifiedPriceUpdates` instead of `addPostPriceUpdates`.
This method does sacrifice some security however -- please see the method documentation for more details.

### Get Instructions

The `PythTransactionBuilder` class used in the examples above helps craft transactions that update prices and then use them in successive instructions.
However, if you would like to craft your own transactions, `PythSolanaReceiver` exposes several methods for constructing the instructions for working with both price update accounts and price feed accounts.
See `examples/post_price_update_instructions.ts` for an example of how to work with instructions.

## Examples

This SDK includes several runnable examples in the `examples/` directory.
You can run these examples by performing the following steps.
First, install and build any necessary typescript dependencies:

1. Clone the `pyth-crosschain` git repo
2. Run `npm install` in the root of the repo
3. Run `npx lerna run build` anywhere in the repo
4. From the `pyth_solana_receiver` directory, run `npx ts-node examples/<example filename>.ts`

The examples require a Solana keypair with SOL to send Solana transactions.
By default, the examples will use the same Solana keypair used by the Solana CLI (at `~/.config/solana/id.json`).
You can override this default by setting the `SOLANA_KEYPAIR` environment variable:

```bash
export SOLANA_KEYPAIR=/path/to/keypair/id.json
```

If you do not have a Solana keypair, you can generate one by downloading and installing the [Solana CLI](https://docs.solanalabs.com/cli/install), the running `solana-keygen new`.
