#!/bin/bash
set -e

if [ -z "$CI" ]; then

MYDIR=$(realpath "$(dirname "$0")")
cd "$MYDIR"

export RPC_URL=http://localhost:8547
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export WALLET_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

cd ..
cd "nitro-testnode"
./test-node.bash script send-l2 --to address_$WALLET_ADDRESS --ethamount 0.1

cd ..
cd "pyth-mock-solidity"
deployed_to=$(
  forge script ./script/MockPyth.s.sol:MockPythScript \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  | grep -oP '(?<=Pyth contract address: )0x[a-fA-F0-9]{40}' | tail -n 1
)
export MOCK_PYTH_ADDRESS=$deployed_to
cd ..
else
  echo "Skipping MockPyth deployment in CI"
fi

env
# Navigate to project root
cd "$(dirname "$(realpath "$0")")/.."

cargo build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -Z build-std-features=panic_immediate_abort

export RPC_URL=http://localhost:8547

# If any arguments are set, just pass them as-is to the cargo test command
if [[ $# -eq 0 ]]; then
    cargo test --features e2e --test "*"
else
    cargo test --features e2e "$@"
fi
