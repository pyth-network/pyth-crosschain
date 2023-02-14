# Pyth SDK CW

This crate exposes utilities to interact with the contract on the CosmWasm ecosystem.
You can also look at the [example contract](../examples/cw-contract/) which demonstrates how to read price feeds from on-chain CosmWasm applications.

## Installation

Add this crate to the dependencies section of your CosmWasm contract's `Cargo.toml` file:

```
[dependencies]
pyth-sdk-cw = "0.1.0"
```

## Usage

Simply import the structs exposed by the crate and use them while interacting with the pyth contract. For example:

```rust
// to query Pyth contract
use pyth_sdk_cw::{
    PriceFeedResponse,
    query_price_feed,
};

... {
    let price_feed_response: PriceFeedResponse = query_price_feed(&deps.querier, state.pyth_contract_addr, state.price_feed_id)?;
    let price_feed = price_feed_response.price_feed;
}
....
```

## Contracts and Price Feeds

Pyth is currently available on the following cosmwasm chains:

### Testnet

| Network   | Contract address                             |
| --------- | -------------------------------------------- |
| Injective | `inj1z60tg0tekdzcasenhuuwq3htjcd5slmgf7gpez` |

Available price feeds on these networks can be find below:

### Price Feeds

| Network           | Available Price Feeds                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Injective Testnet | [https://pyth.network/developers/price-feed-ids#injective-testnet](https://pyth.network/developers/price-feed-ids#injective-testnet) |
