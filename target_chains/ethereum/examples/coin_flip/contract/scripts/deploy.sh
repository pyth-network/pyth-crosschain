#!/bin/bash -e

# URL of the ethereum RPC node to use. Choose this based on your target network
RPC_URL=https://goerli.optimism.io

# The address of the Pyth contract on your network. See the list of contract addresses here https://docs.pyth.network/documentation/pythnet-price-feeds/evm
ENTROPY_CONTRACT_ADDRESS="0x28F16Af4D87523910b843a801454AEde5F9B0459"
PROVIDER="0x368397bDc956b4F23847bE244f350Bde4615F25E"

# Deployed contracts
# Optimism goerli 0x075A5160FF6462924B4124595F6f987187496476

# Note the -l here uses a ledger wallet to deploy your contract. You may need to change this
# option if you are using a different wallet.
forge create src/CoinFlip.sol:CoinFlip \
  -l \
  --rpc-url $RPC_URL \
  --constructor-args \
  $ENTROPY_CONTRACT_ADDRESS \
  $PROVIDER
