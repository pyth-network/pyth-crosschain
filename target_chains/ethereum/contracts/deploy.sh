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

if [[ -e contracts/pyth/PythUpgradable_merged.sol ]]; then
    echo "Flattened contract PythUpgradable_merged.sol exists. Removing before compiling."
    rm contracts/pyth/PythUpgradable_merged.sol
fi

echo "=========== Building dependencies & compiling contract ==========="
pnpm turbo build --filter @pythnetwork/pyth-evm-contract

echo "Deploying the contracts..."

pushd ../../../contract_manager/

pnpm exec ts-node scripts/deploy_evm_pricefeed_contracts.ts --std-output-dir ../target_chains/ethereum/contracts/build/contracts --private-key $PK --deployment-type "stable" --chain "$@"
