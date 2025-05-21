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

# This command also compiles the contracts if latest version is used
pnpm turbo build --filter @pythnetwork/pyth-evm-contract

echo "=========== Deploying the contracts ==========="

version="$1"
shift

if [ "$version" = "latest" ]; then
  echo "Deploying latest version"
  stdoutputdir="../target_chains/ethereum/contracts/build/contracts"
else
  # make sure version has format of vX.Y.Z
  if [[ ! "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Version must be in format vX.Y.Z"
    echo "Usage: $0 <version> <network_a> <network_b> ..."
    exit 1
  fi

  echo "Deploying version $version"
  tmpdir=$(mktemp -d)
  wget https://github.com/pyth-network/pyth-crosschain/releases/download/pyth-evm-contract-$version/contracts-stdoutput.zip -O $tmpdir/contracts-stdoutput.zip
  unzip -q -o $tmpdir/contracts-stdoutput.zip -d $tmpdir
  stdoutputdir="$tmpdir"
fi

pnpm --filter=@pythnetwork/contract-manager exec ts-node scripts/deploy_evm_pricefeed_contracts.ts --std-output-dir $stdoutputdir --private-key $PK --chain "$@"

echo "=========== Cleaning up ==========="
rm -rf $tmpdir

if [ "$version" != "latest" ]; then
    echo "Verify the contracts by using the std-input artifacts of the contracts in https://github.com/pyth-network/pyth-crosschain/releases/tag/pyth-evm-contract-$version"
fi
