#!/bin/bash
#
# This script deploys changes to given networks. Usage:
# $ ./deploy.sh <network_a> <network_a> <...>
# Network names are defined in `truffle-config.js`.
#
# Example: Deploying to some testnet networks
# $ ./deploy.sh bnb_testnet fantom_testnet mumbai
#
# Example: Deploying to some mainnet networks
# $ ./deploy.sh ethereum bnb avalanche
set -euo pipefail

echo "=========== Building dependencies ==========="
npx lerna run build --scope="@pythnetwork/pyth-evm-contract" --include-dependencies

echo "=========== Compiling ==========="

if [[ -e contracts/pyth/PythUpgradable_merged.sol ]]; then
    echo "Flattened contract PythUpgradable_merged.sol exists. Removing before compiling."
    rm contracts/pyth/PythUpgradable_merged.sol
fi

echo "Building the contract..."
# Ensure that we deploy a fresh build with up-to-date dependencies.
rm -rf build && npx truffle compile --all

echo "Adding network metadata to the contract"
# Merge the network addresses into the artifacts, if some contracts are already deployed.
npx apply-registry

# The channel to use for the price sources. Can be `stable` or `beta`.
export CHANNEL=stable

while [[ $# -ne 0 ]]; do
    NETWORK=$1
    shift

    echo "=========== Deploying to ${NETWORK} (if not deployed) ==========="

    # Load the configuration environment variables for deploying your network. make sure to use right env file.
    # If it is a new chain you are deploying to, create a new env file and commit it to the repo.
    if [[ $NETWORK != development ]]; then
        node create-env.js $NETWORK
    else
        echo "Skipping env file creation for development network"
    fi
    set -o allexport && source .env set && set +o allexport

    if [[ $NETWORK == zksync* ]]; then
        echo "Skipping truffle migration on $NETWORK. If you wish to deploy a fresh contract read Deploying.md."
    else
        echo "Migrating..."
        npx truffle migrate --network $MIGRATIONS_NETWORK --compile-none
        echo "Deployment to $NETWORK finished successfully"
    fi

    if [[ $CHANNEL == stable ]]; then
        echo "=========== Syncing guardian sets to ${NETWORK} ==========="
        npm run receiver-submit-guardian-sets -- --network $NETWORK
    fi
done

echo "=========== Finished ==========="
