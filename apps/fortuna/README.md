# Fortuna

Fortuna is a webservice that serves random numbers according to the Entropy protocol.
The webservice generates a hash chain of random numbers and reveals them to callers when permitted by the protocol.
The hash chain is generated from a secret key that is provided to the server on startup.
The service also operates a keeper task that performs callback transactions for user requests.

A single instance of this service can simultaneously serve random numbers for several different blockchains.
Each blockchain is configured in `config.yaml`.

## Build & Test

Fortuna uses Cargo for building and dependency management.
Simply run `cargo build` and `cargo test` to build and test the project.

## Command-Line Interface

The Fortuna binary has a command-line interface to perform useful operations on the contract, such as
registering a new randomness provider, or drawing a random value. To see the available commands, simply run `cargo run`.

## Local Development

To start an instance of the webserver for local testing, you first need to perform a few setup steps:

1. Create a `config.yaml` file to point to the desired blockchains and Entropy contracts. Copy the content in `config.sample.yaml` and follow the directions inside to generate the necessary private keys and secrets.
1. Make sure the wallets you have generated in step (1) contain some gas tokens for the configured networks.
1. Run `cargo run -- setup-provider` to register a randomness provider for this service. This command
   will update the on-chain contracts such that the configured provider key is a randomness provider,
   and its on-chain configuration matches `config.yaml`.

Once you've completed the setup, simply run the following command to start the service:

```bash
RUST_LOG=INFO cargo run -- run
```

This command will start the webservice on `localhost:34000`.
