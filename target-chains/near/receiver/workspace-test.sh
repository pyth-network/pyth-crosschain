#!/usr/bin/env bash
#
# This script is used to prepare the environment in order to run the NEAR
# workspaces based tests. It relies on the relative position of the wormhole-
# stub contract to this directory.
set -euo pipefail

# Setup rust to build wasm.
rustup target add wasm32-unknown-unknown

cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/pyth.wasm .

(
    cd ../wormhole-stub
    cargo build --release --target wasm32-unknown-unknown
    cp target/wasm32-unknown-unknown/release/wormhole_stub.wasm ../receiver
)

RUST_LOG=info cargo nextest run
