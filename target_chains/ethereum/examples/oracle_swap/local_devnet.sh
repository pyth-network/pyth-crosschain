#!/bin/bash

RPC_URL=localhost:8545

BASE_FEED_ID="0x08f781a893bc9340140c5f89c8a96f438bcfae4d1474cc0f688e3a52892c7318"
QUOTE_FEED_ID="0x1fc18861232290221461220bd4e2acd1dcdfbc89c84092c93c18bdc7756c1588"
PRIVATE_KEY="0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
BASE_ERC20_ADDR="0x0290FB167208Af455bB137780163b7B7a9a10C16"
QUOTE_ERC20_ADDR="0x9b1f7F645351AF3631a656421eD2e40f2802E6c0"

YOUR_WALLET_ADDRESS="0x368397bDc956b4F23847bE244f350Bde4615F25E"

cd ../../contracts && ./deploy.sh development

cd ../examples/oracle_swap/contract/

forge create ERC20Mock --rpc-url $RPC_URL --private-key $PRIVATE_KEY --constructor-args "Brazilean Real" "BRL" "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1" "0"
forge create ERC20Mock --rpc-url $RPC_URL --private-key $PRIVATE_KEY --constructor-args "US Dollar" "USD" "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1" "0"

forge create src/OracleSwap.sol:OracleSwap \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL \
  --constructor-args \
  "0xe982E462b094850F12AF94d21D470e21bE9D0E9C" \
  $BASE_FEED_ID \
  $QUOTE_FEED_ID \
  $BASE_ERC20_ADDR \
  $QUOTE_ERC20_ADDR


# swap contract address = 0x67B5656d60a809915323Bf2C40A8bEF15A152e3e

cast send --private-key $PRIVATE_KEY $YOUR_WALLET_ADDRESS --value 10ether
