# Pyth Cosmwasm

This crate includes the actual contract for the CosmWasm ecosystem.

## Integration

You can use `pyth-sdk-cw` which has been published to crates.io to integrate with the Pyth contract.
The sdk exposes data structures and testing utilities for ease of use. Please look into this [pyth-sdk-cw](/target_chains/cosmwasm/sdk/rust)

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

## Developing

The cosmwasm contract lives in the `pyth` subdirectory.
From that directory, you can build the contract with `cargo build` and run unit tests with `cargo test`.
