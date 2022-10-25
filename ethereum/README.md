# Pyth Ethereum Contract

This directory contains The Pyth contract on Ethereum and utilities to deploy it in EVM chains.

## Installation

Run the following command to install required dependencies for the contract:

```
# xc-governance-sdk-js is a local dependency that should be built
pushd third_party/pyth/xc-governance-sdk-js && npm ci && popd
npm ci
```

## Deployment
Please refer to [Deploying.md](./Deploying.md) for more information.

## Foundry

Some tests and scripts use [Foundry](https://getfoundry.sh/). It can be installed via the official installer, or by running

``` sh
pyth-crosschain/ethereum $ bash ../scripts/install-foundry.sh
```

The installer script installs foundry and the appropriate solc version to build the contracts. Foundry itself provides a
mechanism to install solc, but it doesn't work with certain firewall configurations.

You need to install npm dependencies as described in [Installation](#installation). Also, you need to run the following
command to install forge dependencies:

```
npm run install-forge-deps
```

After installing the dependencies. Run `forge build` to build the contracts and `forge test` to
test the contracts using tests in `forge-test` directory.
