# Pyth Starknet Contract

This directory contains the Pyth contract on [Starknet](https://www.starknet.io/).

## Installation

1. Install Scarb (the Cairo and Starknet development toolchain) by following [the installation instructions](https://docs.swmansion.com/scarb/download).
2. Install Starknet Foundry by following [the installation instructions](https://foundry-rs.github.io/starknet-foundry/getting-started/installation.html).

The `.tool-versions` file in this directory specifies the tool versions used by the contract.

## Testing

Run `snforge test` in this directory to run the contract unit tests and integration tests.

The `tests/data.cairo` file contains input data that was generated with `test_vaas` tool.
To regenerate it, run the following commands from the repository root (requires Rust installation):

```
cd target_chains/starknet/tools/test_vaas
cargo run --bin generate_test_data > ../../contracts/tests/data.cairo
```

## Formatting

Run `scarb fmt` to automatically format the source code.

## Local deployment

1. Install Starkli (a cli tool for Starknet) by following [the installation instructions](https://github.com/xJonathanLEI/starkli).
2. Install Devnet (a local Starknet node) by following [the installation instructions](https://0xspaceshard.github.io/starknet-devnet/).
3. Run the deployment script:

```bash
deploy/deploy.sh > ~/pyth.env
```

This generates `~/pyth.env` file that should contain the address of the deployed contract, for example:

```bash
$ cat ~/pyth.env
PYTH_WORMHOLE_ADDRESS=0x07fa5a689a768982ecb60ed05f39ca8f6efe623dd32ee6f3608662e3452a104c
PYTH_CONTRACT_ADDRESS=0x00f61bf0314a478bfc865c71d33cc53c77d0f994ea4a228ccf888d14435a8821
```

Apply these variables to your current shell with:

```bash
export $(xargs < ~/pyth.env)
```
