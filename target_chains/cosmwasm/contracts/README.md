# Pyth Cosmwasm

This crate includes the actual contract and exposes utilities to interact with the contract on the CosmWasm ecosystem.
It also includes an [example contract](../examples/cw-contract/) demonstrating how to read price feeds from on-chain CosmWasm applications.

## Installation

Add this crate to the dependencies section of your CosmWasm contract's `Cargo.toml` file:

```
[dependencies]
pyth-cosmwasm = { git="https://github.com/pyth-network/pyth-crosschain", rev="5d0acc1", features=["library"] }
```

## Usage

Simply import the structs exposed by the crate and use them while interacting with the pyth contract. For example:

```rust
// to query Pyth contract
use pyth_cosmwasm::msg::{
    PriceFeedResponse,
};

... {
    let price_feed_response: PriceFeedResponse =
    deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: state.pyth_contract_addr.into_string(),
        msg:           to_binary(&PythQueryMsg::PriceFeed {
            id: state.price_feed_id,
        })?,
    }))?;

    let price_feed = price_feed_response.price_feed;
}
....
```

## Off-Chain Queries

You can use the provided schemas in the `./pyth/schema` directory to directly query the CosmWasm contract from off-chain applications.
A typical query requires to pass the price feed id as a hex string. it will look like:

```
{
    "price_feed": {
        "id": "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"
    }
}
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
