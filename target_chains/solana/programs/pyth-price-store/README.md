# Pyth Price Store

This program is designed to store Publisher's prices in a specific buffer per each publisher. Later, the prices from each publisher are retrieved in the
Pythnet validator to calculate the aggregate price.

## Build

To build the program in a verifiable way, use [Solana Verify CLI](https://github.com/Ellipsis-Labs/solana-verifiable-build). This tool builds the program in
a docker container to ensure that the resulting binary is deterministic and verifiable. Run the following command to build the program:

```bash
solana-verify build -- --features solana-program
```

Once the build is complete, the program binary will be located in the `target/deploy` directory.

## Test

Run `cargo test` to run the tests.
