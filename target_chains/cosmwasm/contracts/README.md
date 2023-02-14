# Pyth Cosmwasm

This crate includes the actual contract for the CosmWasm ecosystem.

## Integration

You can use `pyth-sdk-cw` which has been published to crates.io to integrate with the Pyth contract.
The sdk exposes data structures and testing utilities for ease of use. Please look into this [pyth-sdk-cw](https://github.com/pyth-network/pyth-crosschain/tree/main/target_chains/cosmwasm/pyth-sdk-cw)

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
