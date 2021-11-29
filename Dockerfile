#syntax=docker/dockerfile:1.2
# Target name conventions
# base-* - targets for caching setup of dependencies
# Wormhole Go tools add their pinned version

# Cache a build of Wormhole's Go utilities
FROM docker.io/golang:1.17.0 as go-tools
ARG WH_ROOT=/usr/src/wormhole
ENV WH_ROOT=$WH_ROOT

ADD tools/build.sh $WH_ROOT/tools/
ADD tools/go.* $WH_ROOT/tools/

WORKDIR $WH_ROOT/tools
ENV   CGO_ENABLED=0
RUN ./build.sh

# Cache a build of TypeScript gRPC bindings
FROM node:16-alpine@sha256:004dbac84fed48e20f9888a23e32fa7cf83c2995e174a78d41d9a9dd1e051a20 AS nodejs-proto-build
ARG WH_ROOT=/usr/src/wormhole

# Copy go build artifacts
COPY --from=go-tools $WH_ROOT/tools $WH_ROOT/tools

ADD buf.* $WH_ROOT/
ADD proto $WH_ROOT/proto

ADD tools/package.json $WH_ROOT/tools/
ADD tools/package-lock.json $WH_ROOT/tools/

WORKDIR $WH_ROOT/tools
RUN npm ci

WORKDIR $WH_ROOT
RUN tools/bin/buf generate --template buf.gen.web.yaml

# Root image for most of the following targets
FROM ubuntu:20.04@sha256:626ffe58f6e7566e00254b638eb7e0f3b11d4da9675088f4781a50ae288f3322 as base

ARG WH_EMITTER="11111111111111111111111111111115"
ARG WH_BRIDGE="11111111111111111111111111111116"
ARG WH_ROOT=/usr/src/wormhole

ENV DEBIAN_FRONTEND=noninteractive

# Copy args to envs in order for them to be inherited
ENV EMITTER_ADDRESS=$WH_EMITTER
ENV BRIDGE_ADDRESS=$WH_BRIDGE
ENV WH_ROOT=$WH_ROOT

# System deps
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    clang \
    curl \
    libssl-dev \
    libudev-dev \
    llvm \
    pkg-config \
    python3 \
    zlib1g-dev

# Base with known good Rust toolchain via rustup
FROM base as base-with-rust
RUN sh -c "$(curl --proto '=https' --tlsv1.2 -sSfL https://sh.rustup.rs)" -- -y --default-toolchain nightly-2021-08-01
ENV PATH=$PATH:/root/.cargo/bin

# Base with NodeJS
FROM base as base-with-node

RUN bash -c "$(curl -fsSL https://deb.nodesource.com/setup_16.x)"
RUN apt-get update
RUN apt-get install -y nodejs

# Base with a known good Solana SDK distribution
FROM base-with-rust as base-with-sol

RUN sh -c "$(curl -sSfL https://release.solana.com/v1.7.8/install)"
ENV PATH=$PATH:/root/.local/share/solana/install/active_release/bin

# Solana does a download at the beginning of a *first* build-bpf call. Trigger and layer-cache it explicitly.
RUN cargo init --lib /tmp/decoy-crate && \
    cd /tmp/decoy-crate && cargo build-bpf && \
    rm -rf /tmp/decoy-crate

# Base with tools for Rust WebAssembly builds
FROM base-with-rust as base-with-wasm-pack
RUN cargo install wasm-pack --version 0.9.1

# Solana contract and off-chain client for pyth2wormhole
FROM base-with-sol as p2w-sol-contracts

ADD solana $WH_ROOT/solana

WORKDIR $WH_ROOT/solana/pyth2wormhole/program

RUN cargo build-bpf

WORKDIR $WH_ROOT/solana/pyth2wormhole
RUN cargo build -p pyth2wormhole-client
ENV PATH "$PATH:$WH_ROOT/solana/pyth2wormhole/target/debug/"

# Pyth2wormhole's Rust WebAssembly dependencies
FROM base-with-wasm-pack as p2w-sol-wasm
WORKDIR $WH_ROOT/solana
ADD solana .

# Build wasm binaries for wormhole-sdk
WORKDIR $WH_ROOT/solana/bridge/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm

# Build wasm binaries for Wormhole migration
WORKDIR $WH_ROOT/solana/migration
RUN wasm-pack build --target bundler -d bundler -- --features wasm

# Build wasm binaries for NFT bridge
WORKDIR $WH_ROOT/solana/modules/nft_bridge/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm

# Build wasm binaries for token bridge
WORKDIR $WH_ROOT/solana/modules/token_bridge/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm

# Build wasm-binaries for p2w-sdk
WORKDIR $WH_ROOT/solana/pyth2wormhole/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm


# Final p2w-attest target
FROM p2w-sol-contracts as p2w-attest
WORKDIR $WH_ROOT/third_party/pyth

ADD third_party/pyth/p2w_autoattest.py third_party/pyth/pyth_utils.py ./

# Solidity contracts for Pyth2Wormhole
FROM base-with-node as p2w-eth-contracts
WORKDIR $WH_ROOT/ethereum
ADD ethereum .

RUN npm ci && npm run build

# Wormhole SDK
FROM p2w-eth-contracts as wormhole-sdk
WORKDIR $WH_ROOT/sdk/js
ADD sdk/js .

RUN ls -la
RUN ls -la src
RUN pwd

# Copy proto bindings for Wormhole SDK
COPY --from=nodejs-proto-build $WH_ROOT/sdk/js/src/proto src/proto

# Copy wasm artifacts for Wormhole SDK
COPY --from=p2w-sol-wasm $WH_ROOT/solana/bridge/program/bundler src/solana/core
COPY --from=p2w-sol-wasm $WH_ROOT/solana/migration/bundler src/solana/migration
COPY --from=p2w-sol-wasm $WH_ROOT/solana/modules/nft_bridge/program/bundler src/solana/nft
COPY --from=p2w-sol-wasm $WH_ROOT/solana/modules/token_bridge/program/bundler src/solana/token

RUN npm ci

# Pyth2wormhole SDK
FROM wormhole-sdk as p2w-sdk
WORKDIR $WH_ROOT/third_party/pyth/p2w-sdk

# Copy wasm artifacts for Pyth2Wormhole SDK
COPY --from=p2w-sol-wasm $WH_ROOT/solana/pyth2wormhole/program/bundler src/solana/p2w-core
COPY --from=p2w-sol-wasm $WH_ROOT/solana/bridge/program/bundler src/solana/wormhole-core

ADD third_party/pyth/p2w-sdk .
RUN npm ci && npm run build


# Final p2w-relay target
FROM p2w-sdk as p2w-relay
WORKDIR $WH_ROOT/third_party/pyth/p2w-relay

ADD third_party/pyth/p2w-relay .
RUN npm ci && npm run build
