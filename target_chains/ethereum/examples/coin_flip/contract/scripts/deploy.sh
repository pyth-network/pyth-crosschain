#!/bin/bash -e

# URL of the ethereum RPC node to use. Choose this based on your target network
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# The address of the Pyth contract on your network. See the list of contract addresses here https://docs.pyth.network/documentation/pythnet-price-feeds/evm
ENTROPY_CONTRACT_ADDRESS="0x549Ebba8036Ab746611B4fFA1423eb0A4Df61440"
PROVIDER="0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344"

# Deployments
# optimism-sepolia 0x2eE67fF5d8548fF544f2c178a0FcAFe503A634Be
# arbitrum-sepolia 0xCd76c50c3210C5AaA9c39D53A4f95BFd8b1a3a19

# Note the -l here uses a ledger wallet to deploy your contract. You may need to change this
# option if you are using a different wallet.
forge create src/CoinFlip.sol:CoinFlip \
  -l \
  --rpc-url $RPC_URL \
  --constructor-args \
  $ENTROPY_CONTRACT_ADDRESS \
  $PROVIDER
