# Argus

Argus is a webservice that serves price updates according to the Pulse protocol.
The webservice processes and delivers price updates to callers when permitted by the protocol.
The service operates a keeper task that performs callback transactions for user requests.

A single instance of this service can simultaneously serve price updates for several different blockchains.
Each blockchain is configured in `config.yaml`.

## Build & Test

Argus uses Cargo for building and dependency management.
Simply run `cargo build` and `cargo test` to build and test the project.

## Command-Line Interface

The Argus binary has a command-line interface to perform useful operations on the contract, such as
registering a new price provider, or requesting price updates. To see the available commands, simply run `cargo run`.

## Local Development

To start an instance of the webserver for local testing, you first need to perform a few setup steps:

1. Create a `config.yaml` file to point to the desired blockchains and Pulse contracts. Copy the content in `config.sample.yaml` and follow the directions inside to generate the necessary private keys and secrets.
1. Make sure the wallets you have generated in step (1) contain some gas tokens for the configured networks.
1. Run `cargo run -- setup-provider` to register a price provider for this service. This command
   will update the on-chain contracts such that the configured provider key is a price provider,
   and its on-chain configuration matches `config.yaml`.

Once you've completed the setup, simply run the following command to start the service:

```bash
RUST_LOG=INFO cargo run -- run
```

This command will start the webservice on `localhost:34000`.
