#syntax=docker/dockerfile:1.2
FROM ubuntu:20.04@sha256:626ffe58f6e7566e00254b638eb7e0f3b11d4da9675088f4781a50ae288f3322 as base

ENV DEBIAN_FRONTEND=noninteractive
ENV WH_ROOT=/usr/src/wormhole
ARG WH_EMITTER="11111111111111111111111111111115"
ENV EMITTER_ADDRESS=$WH_EMITTER


# System deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    clang \
    curl \
    libssl-dev \
    libudev-dev \
    llvm \
    pkg-config \
    python3 \
    zlib1g-dev \
		&& apt-get clean \
		&& rm -rf /var/lib/apt/lists/*

FROM base as base-with-rust
# Install Rust
RUN sh -c "$(curl --proto '=https' --tlsv1.2 -sSfL https://sh.rustup.rs)" -- -y --default-toolchain nightly-2021-08-01
ENV PATH=$PATH:/root/.cargo/bin

FROM base as base-with-node
# Install Node
RUN bash -c "$(curl -fsSL https://deb.nodesource.com/setup_16.x)"
RUN apt-get install -y --no-install-recommends nodejs

FROM base-with-rust as base-with-sol
# Install Solana
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.7.8/install)"
ENV PATH=$PATH:/root/.local/share/solana/install/active_release/bin

# Solana does a download at the beginning of a *first* build-bpf call. Trigger and layer-cache it explicitly.
WORKDIR /tmp/decoy-crate
RUN cargo init --lib /tmp/decoy-crate && \
    cargo build-bpf && \
    rm -rf /tmp/decoy-crate

FROM base-with-rust as base-with-wasm-pack
RUN cargo install wasm-pack --version 0.9.1

FROM base-with-sol as p2w-sol-contracts

COPY solana $WH_ROOT/solana

WORKDIR $WH_ROOT/solana/pyth2wormhole/program

RUN cargo build-bpf

WORKDIR $WH_ROOT/solana/pyth2wormhole
RUN cargo build -p pyth2wormhole-client

FROM base-with-wasm-pack as p2w-sol-wasm
WORKDIR $WH_ROOT/solana
COPY solana .

# Build wasm binaries for wormhole-sdk
WORKDIR $WH_ROOT/solana/bridge/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm

# Build wasm-binaries for p2w-sdk
WORKDIR $WH_ROOT/solana/pyth2wormhole/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm

FROM p2w-sol-contracts as p2w-attest
WORKDIR $WH_ROOT/third_party/pyth

COPY third_party/pyth/p2w_autoattest.py third_party/pyth/pyth_utils.py ./

FROM base-with-node as p2w-eth-contracts
WORKDIR $WH_ROOT/ethereum
COPY ethereum .

RUN npm ci && npm run build

FROM p2w-eth-contracts as wormhole-sdk
WORKDIR $WH_ROOT/sdk/js
COPY sdk/js .

COPY --from=p2w-sol-wasm $WH_ROOT/solana/bridge/program/bundler src/solana/core

RUN npm ci

FROM wormhole-sdk as p2w-sdk
WORKDIR $WH_ROOT/third_party/pyth/p2w-sdk

COPY --from=p2w-sol-wasm $WH_ROOT/solana/pyth2wormhole/program/bundler src/solana/p2w-core
COPY --from=p2w-sol-wasm $WH_ROOT/solana/bridge/program/bundler src/solana/wormhole-core

COPY third_party/pyth/p2w-sdk .
RUN npm ci && npm run build


FROM p2w-sdk as p2w-relay
WORKDIR $WH_ROOT/third_party/pyth/p2w-relay

COPY third_party/pyth/p2w-relay .
RUN npm ci && npm run build
