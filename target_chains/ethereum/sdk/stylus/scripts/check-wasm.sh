#!/bin/bash
# This script compiles Rust contracts to WebAssembly and validates the .wasm binaries for correctness using cargo stylus check.
# It retrieves crate names from Cargo.toml files in the examples directory and ensures each compiled contract is valid

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
  cargo stylus check --wasm-file ./target/wasm32-unknown-unknown/release/"$CONTRACT_BIN_NAME"
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
  check_wasm "$CRATE_NAME"
done
