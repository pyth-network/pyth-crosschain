#!/bin/bash
set -e

MYDIR=$(realpath "$(dirname "$0")")
cd "$MYDIR"
cd ..

export RPC_URL=http://localhost:8547
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export WALLER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ls
cd "nitro-testnode"
./test-node.bash script send-l2 --to address_$WALLER_ADDRESS --ethamount 0.1    

cd ..
cd "pyth-solidity"
deployed_to=$(
  forge script ./script/MockPyth.s.sol:MockPythScript \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \ | grep -oP '(?<=Pyth contract address: )0x[a-fA-F0-9]{40}' | tail -n 1
)

export MOCK_PYTH_ADDRESS=$deployed_to
cd ..
# Output the captured address

NIGHTLY_TOOLCHAIN=${NIGHTLY_TOOLCHAIN:-nightly-2024-01-01}
cargo +"$NIGHTLY_TOOLCHAIN" build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -Z build-std-features=panic_immediate_abort

# No need to compile benchmarks with `--release`
# since this only runs the benchmarking code and the contracts have already been compiled with `--release`
cargo run -p benches

echo "NOTE: To measure non cached contract's gas usage correctly,
 benchmarks should run on a clean instance of the nitro test node."
echo
echo "Finished running benches!"