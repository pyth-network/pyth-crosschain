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

echo "=========== Compiling ==========="

echo "Building the contract..."
# Ensure that we deploy a fresh build with up-to-date dependencies.
rm -rf build && npx truffle compile --all

echo "Adding network metadata to the contract"
# Merge the network addresses into the artifacts, if some contracts are already deployed.
npx apply-registry

while [[ $# -ne 0 ]]; do
    NETWORK=$1
    shift

    echo "=========== Deploying to ${NETWORK} (if not deployed) ==========="

    # Load the configuration environment variables for deploying your network. make sure to use right env file.
    # If it is a new chain you are deploying to, create a new env file and commit it to the repo.
    rm -f .env; ln -s .env.prod.$NETWORK .env && set -o allexport && source .env set && set +o allexport

    if [[ $NETWORK == zksync* ]]; then
        echo "Skipping truffle migration on $NETWORK. If you wish to deploy a fresh contract read Deploying.md."
    else
        echo "Migrating..."
        npx truffle migrate --network $MIGRATIONS_NETWORK --compile-none
        echo "Deployment to $NETWORK finished successfully"
    fi

    echo "=========== Syncing contract state ==========="
    npx truffle exec scripts/syncPythState.js --network $MIGRATIONS_NETWORK || echo "Syncing failed/incomplete.. skipping"
done

echo "=========== Finished ==========="
