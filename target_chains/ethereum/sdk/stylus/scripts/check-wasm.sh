#!/bin/bash
set -e

mydir=$(dirname "$0")
cd "$mydir" || exit
cd ..

# Check contract wasm binary by crate name
check_wasm () {
  local CONTRACT_CRATE_NAME=$1
  local CONTRACT_BIN_NAME="${CONTRACT_CRATE_NAME//-/_}.wasm"

  echo
  echo "Checking contract $CONTRACT_CRATE_NAME"
  cargo stylus check -e https://sepolia-rollup.arbitrum.io/rpc --wasm-file ./target/wasm32-unknown-unknown/release/"$CONTRACT_BIN_NAME"
}

# Retrieve all alphanumeric contract's crate names in `./examples` directory.
get_example_crate_names () {
  # shellcheck disable=SC2038
  # NOTE: optimistically relying on the 'name = ' string at Cargo.toml file
  find ./examples -maxdepth 2 -type f -name "Cargo.toml" | xargs grep 'name = ' | grep -oE '".*"' | tr -d "'\""
}

cargo build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -Z build-std-features=panic_immediate_abort

for CRATE_NAME in $(get_example_crate_names)
do
  check_wasm "$CRATE_NAME"
done
