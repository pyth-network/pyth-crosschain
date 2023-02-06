# Pyth SDK Example Contract for CosmWasm

This repository contains an example contract that demonstrates how to query Pyth on-chain contract.
The example [contract](src/contract.rs) has two functions:

- `instantiate` sets the Pyth contract address and price feed id that the contract uses.
  This function is intended to be called once when the contract is deployed.
  See the [price-feed-ids](https://pyth.network/developers/price-feed-ids) for the list of possible price feed ids.
- `query` queries the Pyth contract
  - to get the current price for the configured price feed id.
  - to fetch the default valid time period.
  - to calculate the fee for updating a price feed.

## Testnet Demo

This example contract is running on Injective testnet at `inj1cc9effer9ttdfrkfghfj7y3ph48c36a9y8d7cv`.
This contract has been instantiated to return the price of `Crypto.INJ/USD`.
You can query the contract using the schema at `schema/example-cw-contract.json`.

Some example queries:

```
{
  "fetch_price": {}
}
```

If the query is successful, the output should look like:

```
{
  current_price: { price: "8704350000", conf: "3150000", expo: -8, publish_time: "1674224555332"  },
  ema_price: { price: "8665158600", conf: "2965370", expo: -8, publish_time: "1674224555332" }
}
```

If the price feed is currently not available you will see:

```
rpc error: code = Unknown desc = Generic error: Current price is not available: contract query failed
```

## Developing

If you would like to deploy a changed version of this contract, the process consists of two steps:

1. Build the WASM for the contract.
2. Upload the code and instantiate a new contract.

### Build WASM

See the [Developing instructions](Developing.md) for how to build the WASM for the contract.
The instructions in that document will build a file called `example_cw_contract.wasm` under the `artifacts/` directory.
