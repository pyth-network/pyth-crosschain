#!/bin/bash -e

# URL of the ethereum RPC node to use. Choose this based on your target network
# (e.g., this deploys to goerli optimism testnet)
RPC_URL=http://127.0.0.1:8545

PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Note the -l here uses a ledger wallet to deploy your contract. You may need to change this
# option if you are using a different wallet.
forge create contracts/random/PythRandom.sol:PythRandom \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

CONTRACT_ADDRESS="0x5FbDB2315678afecb367f032d93F642f64180aa3"

cast send $CONTRACT_ADDRESS "initialize(uint)" "7" --rpc-url http://127.0.0.1:8545 --private-key $PRIVATE_KEY

PROVIDER_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
PROVIDER_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
PROVIDER_COMMITMENT="0x59c6995e998f97a5a0044966f0f945389dfc9e86"
PROVIDER_COMMITMENT_METADATA="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
PROVIDER_COMMITMENT_END="1000"

cast send $CONTRACT_ADDRESS "register(uint,bytes20,bytes32,uint64)" "8" "$PROVIDER_COMMITMENT" "$PROVIDER_COMMITMENT_METADATA" "$PROVIDER_COMMITMENT_END" --rpc-url http://127.0.0.1:8545 --private-key $PROVIDER_PRIVATE_KEY

# cast send $CONTRACT_ADDRESS "requestRandomNumber(address,bytes32)" "$PROVIDER_ADDRESS" "$PROVIDER_COMMITMENT_METADATA" --rpc-url http://127.0.0.1:8545 --private-key $PRIVATE_KEY

echo "Next sequence number"
cast call $CONTRACT_ADDRESS "nextSequenceNumber(address)" "$PROVIDER_ADDRESS" --rpc-url http://127.0.0.1:8545