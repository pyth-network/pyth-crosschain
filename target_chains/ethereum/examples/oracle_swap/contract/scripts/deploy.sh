#!/bin/bash -e

# URL of the ethereum RPC node to use. Choose this based on your target network
# (e.g., this deploys to goerli optimism testnet)
RPC_URL=https://endpoints.omniatech.io/v1/matic/mumbai/public

# The address of the Pyth contract on your network. See the list of contract addresses here https://docs.pyth.network/documentation/pythnet-price-feeds/evm
PYTH_CONTRACT_ADDRESS="0xff1a0f4744e8582DF1aE09D5611b887B6a12925C"
# The Pyth price feed ids of the base and quote tokens. The list of ids is available here https://pyth.network/developers/price-feed-ids
# Note that each feed has different ids on mainnet and testnet.
BASE_FEED_ID="0x08f781a893bc9340140c5f89c8a96f438bcfae4d1474cc0f688e3a52892c7318"
QUOTE_FEED_ID="0x1fc18861232290221461220bd4e2acd1dcdfbc89c84092c93c18bdc7756c1588"
# The address of the base and quote ERC20 tokens.
BASE_ERC20_ADDR="0xB3a2EDFEFC35afE110F983E32Eb67E671501de1f"
QUOTE_ERC20_ADDR="0x8C65F3b18fB29D756d26c1965d84DBC273487624"

# Note the -l here uses a ledger wallet to deploy your contract. You may need to change this
# option if you are using a different wallet.
forge create src/OracleSwap.sol:OracleSwap \
  -l \
  --rpc-url $RPC_URL \
  --constructor-args \
  $PYTH_CONTRACT_ADDRESS \
  $BASE_FEED_ID \
  $QUOTE_FEED_ID \
  $BASE_ERC20_ADDR \
  $QUOTE_ERC20_ADDR
