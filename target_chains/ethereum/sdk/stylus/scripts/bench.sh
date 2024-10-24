#!/bin/bash
set -e

MYDIR=$(realpath "$(dirname "$0")")
cd "$MYDIR"
cd ..

NIGHTLY_TOOLCHAIN=${NIGHTLY_TOOLCHAIN:-nightly-2024-01-01}
cargo +"$NIGHTLY_TOOLCHAIN" build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -Z build-std-features=panic_immediate_abort

export RPC_URL=http://localhost:8547

# No need to compile benchmarks with `--release`
# since this only runs the benchmarking code and the contracts have already been compiled with `--release`
cargo run -p benches

echo "NOTE: To measure non cached contract's gas usage correctly,
 benchmarks should run on a clean instance of the nitro test node."
echo
echo "Finished running benches!"
