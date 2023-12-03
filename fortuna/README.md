# Fortuna

Fortuna is a webservice that serves random numbers according to the Entropy protocol.
The webservice generates a hash chain of random numbers and reveals them to callers when permitted by the protocol.
The hash chain is generated from a secret key that is provided to the server on startup.

A single instance of this webservice can simultaneously serve random numbers for several different blockchains.
Each blockchain is configured in `config.yaml`.

## Build & Test

Fortuna uses Cargo for building and dependency management.
Simply run `cargo build` and `cargo test` to build and test the project.

## Command-Line Interface

The Fortuna binary has a command-line interface to perform useful operations on the contract, such as
registering a new randomness provider, or drawing a random value. To see the available commands, simply run `cargo run`.

## Local Development

To start an instance of the webserver for local testing, you first need to perform a few setup steps:

1. Edit `config.yaml` to point to the desired blockchains and Entropy contracts.
1. Generate a secret key. The secret key is a 32-byte random value used to construct the hash chains.
   You can generate this value using the `openssl` command:
   `openssl rand -hex 32`
1. Generate an ethereum wallet for the provider. You can do this in foundry using `cast wallet new`.
   Note both the private key and the address; you will need both for subsequent steps.
1. Register a randomness provider for this service: `cargo run -- register-provider --chain-id <chain id> --secret <secret> --private-key <private-key>`.
   The chain id is the key of the blockchain in `config.yaml`, the secret is from step (2), and the private key is from step (3).
   Note that you need to run this command once per blockchain configured in `config.yaml`.

Once you've completed the setup, simply run the following command, using the secret from step (2) and the wallet address from step (3) as the provider:

```bash
cargo run -- run --secret <secret> --provider <provider>
```

This command will start the webservice on `localhost:34000`.
