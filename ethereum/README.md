# Pyth Ethereum Contract

This directory contains The Pyth contract on Ethereum and utilities to deploy it in EVM chains.

## Installation

Run the following command to install required dependencies for the contract:

```
# xc-governance-sdk-js is a local dependency that should be built
# it is used in deployment (truffle migrations) to generate/sanity check
# the governance VAAs 
pushd third_party/pyth/xc-governance-sdk-js && npm ci && popd
npm ci
```

## Deployment
Please refer to [Deploying.md](./Deploying.md) for more information.

## Foundry

Foundry can be installed by the official installer, or by running our helper script which will automatically pull the correct installation script individually for Foundry and the Solidity compiler for your current OS. This may work better if you are running into networking/firewall issues using Foundry's Solidity installer. To use helper script, run the command below from this directory:

``` sh
pyth-crosschain/ethereum $ bash ../scripts/install-foundry.sh
```

You need to install npm dependencies as described in [Installation](#installation). Also, you need to run the following
command to install forge dependencies:

```
npm run install-forge-deps
```

After installing the dependencies. Run `forge build` to build the contracts and `forge test` to
test the contracts using tests in `forge-test` directory.
