#!/bin/bash -e

# URL of the ethereum RPC node to use. Choose this based on your target network
RPC_URL=https://api.testnet.evm.eosnetwork.com/

# The address of the Pyth contract on your network. See the list of contract addresses here https://docs.pyth.network/documentation/pythnet-price-feeds/evm
ENTROPY_CONTRACT_ADDRESS="0xD42c7a708E74AD19401D907a14146F006c851Ee3"
PROVIDER="0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344"

# Deployments
# optimism-goerli 0x3bA217Cd7840Cc5B34FD5B7263Cebd8CD8665788
# avalanche-fuji 0xE7E52C85907d59C45b2C56EF32B78F514F8c547a
# eos-evm-testnet 0x413405Aee2db95cb028B60CBAd87FC0B932947f4

# Note the -l here uses a ledger wallet to deploy your contract. You may need to change this
# option if you are using a different wallet.
forge create src/CoinFlip.sol:CoinFlip \
  -l \
  --rpc-url $RPC_URL \
  --constructor-args \
  $ENTROPY_CONTRACT_ADDRESS \
  $PROVIDER
