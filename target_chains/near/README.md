# Pyth NEAR

This directory contains the Pyth contract for NEAR, examples, and utilities to deploy. Within the `example/`
directory you will find an example skeleton NEAR contract that updates and uses a price. You can find
updates to test with from the Hermes API. Additionally see the `scripts/update.sh` script for an example
of how to manually submit a price update from the CLI.

## Deployment

Deploying the NEAR contract has three steps:

1. Create a NEAR key with `near generate-key`
2. Fetch NEAR tokens from an available faucet, at last deploy around 100~ NEAR were needed.
3. See the example deploy script in `scripts/deploy.sh` to deploy the contract. You can find a codehash by:
   - `sha256sum pyth.wasm` after building the contract.
   - `list(bytes.fromhex(hash))` in Python to get a byte array.
   - Replace the `codehash` field in deploy.sh for the initial codehash.

## Further Documentation

You can find more in-depth documentation on the [Pyth Website][pyth website] for a more in-depth guide to
working with Pyth concepts in general in the context of NEAR.

[pyth website]: https://docs.pyth.network/documentation/pythnet-price-feeds/near
