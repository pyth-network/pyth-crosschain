# Pyth NEAR

This directory contains the Pyth contract for NEAR, examples, and utilities to deploy. Within the `example/`
directory you will find an example skeleton NEAR contract that updates and uses several prices. You can find
payloads to test with from the Hermes API. Additionally see the `scripts/update.sh` script for an example
of how to manually submit a price update from the CLI.

## Deployment

Deploying the NEAR contract has the following steps:

1. Create an account for the new contract:

```
near create-account contract-url.near --use-account <payer_account_id> --public-key ed25519:<authority_public_key> --initial-balance "2.5" --network-id mainnet
```

2. Build the contract:

```
cd receiver
cargo near build reproducible-wasm
```

3. Deploy the contract code:

```
near deploy contract-url.near target/near/pyth_near.wasm --network-id mainnet --init-function new --init-args '{"wormhole":"contract.wormhole_crypto.near","initial_source":{"emitter":[225,1,250,237,172,88,81,227,43,155,35,181,249,65,26,140,43,172,74,174,62,212,221,123,129,29,209,167,46,164,170,113],"chain":26},"gov_source":{"emitter":[86,53,151,154,34,28,52,147,30,50,98,11,146,147,164,99,6,85,85,234,113,254,151,205,98,55,173,232,117,177,46,158],"chain":1},"update_fee":"1","stale_threshold":60}'
```

To check the contract:

1. Update price feeds:

```
near call --network-id mainnet contract-url.near update_price_feeds '{ "data": "504e415501..." }' --use-account <payer_account> --gas 300000000000000 --deposit 0.01
```

2. Query price feed:

```
near view --network-id mainnet contract-url.near get_price_unsafe '{ "price_identifier": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" }'
```

## Further Documentation

You can find more in-depth documentation on the [Pyth Website][pyth website] for a more in-depth guide to
working with Pyth concepts in general in the context of NEAR.

[pyth website]: https://docs.pyth.network/documentation/pythnet-price-feeds/near
