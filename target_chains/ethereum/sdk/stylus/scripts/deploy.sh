#!/bin/bash
# This script compiles Rust contracts to WebAssembly and deploys the .wasm binaries to a blockchain using `cargo stylus deploy`.
# It retrieves crate names from Cargo.toml files in the examples directory and automates the deployment process for each contract.

set -e

mydir=$(dirname "$0")
cd "$mydir" || exit
cd ..

export RPC_URL=http://localhost:8547
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export WALLER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

cd "nitro-testnode"
./test-node.bash script send-l2 --to address_$WALLER_ADDRESS --ethamount 0.1


cd ..
# Check contract wasm binary by crate name
deploy_wasm () {
  local CONTRACT_CRATE_NAME=$1
  local CONTRACT_BIN_NAME="${CONTRACT_CRATE_NAME//-/_}.wasm"

  echo "deploy contract $CONTRACT_CRATE_NAME"
  cargo stylus deploy --wasm-file ./target/wasm32-unknown-unknown/release/"$CONTRACT_BIN_NAME" \
  --endpoint $RPC_URL \
  --private-key $PRIVATE_KEY \
  --no-verify
  }

# Retrieve all alphanumeric contract's crate names in `./examples` directory.
get_example_crate_names () {
  # shellcheck disable=SC2038
  # NOTE: optimistically relying on the 'name = ' string at Cargo.toml file
  find ./examples -maxdepth 2 -type f -name "Cargo.toml" | xargs grep 'name = ' | grep -oE '".*"' | tr -d "'\""
}

NIGHTLY_TOOLCHAIN=${NIGHTLY_TOOLCHAIN:-nightly-2024-09-05}

cargo +"$NIGHTLY_TOOLCHAIN" build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -Z build-std-features=panic_immediate_abort

for CRATE_NAME in $(get_example_crate_names)
do
  deploy_wasm "$CRATE_NAME"
done
