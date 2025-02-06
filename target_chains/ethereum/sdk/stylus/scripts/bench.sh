#!/bin/bash
set -e

if [ -z "$CI" ]; then

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
cd "pyth-mock-solidity"
deployed_to=$(
  forge script ./script/MockPyth.s.sol:MockPythScript \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \ | grep -oP '(?<=Pyth contract address: )0x[a-fA-F0-9]{40}' | tail -n 1
)

export MOCK_PYTH_ADDRESS=$deployed_to
cd ..
else
  echo "Skipping MockPyth deployment in CI"
fi


MYDIR=$(realpath "$(dirname "$0")")
cd "$MYDIR"
cd ..

# Optimize contract's wasm binary by crate name.
opt_wasm () {
  local CONTRACT_CRATE_NAME=$1
  local CONTRACT_BIN_NAME="${CONTRACT_CRATE_NAME//-/_}.wasm"
  local CONTRACT_OPT_BIN_NAME="${CONTRACT_CRATE_NAME//-/_}_opt.wasm"

  echo
  echo "Optimizing $CONTRACT_CRATE_NAME WASM binary"
  # https://rustwasm.github.io/book/reference/code-size.html#use-the-wasm-opt-tool
  wasm-opt -O3 -o ./target/wasm32-unknown-unknown/release/"$CONTRACT_OPT_BIN_NAME" ./target/wasm32-unknown-unknown/release/"$CONTRACT_BIN_NAME"
}

# Retrieve all alphanumeric contract's crate names in `./examples` directory.
get_example_crate_names () {
  # shellcheck disable=SC2038
  # NOTE: optimistically relying on the 'name = ' string at Cargo.toml file
  find ./examples -maxdepth 2 -type f -name "Cargo.toml" | xargs grep 'name = ' | grep -oE '".*"' | tr -d "'\""
}

cargo build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -Z build-std-features=panic_immediate_abort

# Optimize contract's wasm for gas usage.
for CRATE_NAME in $(get_example_crate_names)
do
  opt_wasm "$CRATE_NAME"
done

export RPC_URL=http://localhost:8547

# No need to compile benchmarks with `--release`
# since this only runs the benchmarking code and the contracts have already been compiled with `--release`.
cargo run -p benches

echo "NOTE: To measure non cached contract's gas usage correctly,
 benchmarks should run on a clean instance of the nitro test node."
echo
echo "Finished running benches!"
