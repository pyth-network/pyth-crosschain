#!/bin/bash -e

# URL of the ethereum RPC node to use. Choose this based on your target network
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# The address of the Pyth contract on your network. See the list of contract addresses here https://docs.pyth.network/documentation/pythnet-price-feeds/evm
ENTROPY_CONTRACT_ADDRESS="0xD42c7a708E74AD19401D907a14146F006c851Ee3"
PROVIDER="0x368397bDc956b4F23847bE244f350Bde4615F25E"

# Avalanche fuji address:
# 0x544c5ab499C38dff495724451783F63a3eeA40F2

# Note the -l here uses a ledger wallet to deploy your contract. You may need to change this
# option if you are using a different wallet.
forge create src/CoinFlip.sol:CoinFlip \
  -l \
  --rpc-url $RPC_URL \
  --constructor-args \
  $ENTROPY_CONTRACT_ADDRESS \
  $PROVIDER
