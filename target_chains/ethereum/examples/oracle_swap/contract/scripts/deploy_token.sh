#!/bin/bash -e

# URL of the ethereum RPC node to use. Choose this based on your target network
# (e.g., this deploys to goerli optimism testnet)
RPC_URL=https://goerli.optimism.io

# Name and symbol for the test token.
TOKEN_NAME="My test token"
TOKEN_SYMBOL="TEST"
# Fill this in with your wallet address, 0x....
INITIAL_MINT="0x12..."

# Note the -l here uses a ledger wallet to deploy your contract. You may need to change this
# option if you are using a different wallet.
forge create ERC20Mock --rpc-url $RPC_URL -l --constructor-args "$TOKEN_NAME" "$TOKEN_SYMBOL" "$INITIAL_MINT" "0"
