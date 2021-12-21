#syntax=docker/dockerfile:1.2
# Target name conventions
# base-* - targets for caching setup of dependencies
# Wormhole Go tools add their pinned version

# Cache a build of Wormhole's Go utilities
FROM docker.io/golang:1.17.0 as base-go
ARG WH_ROOT=/usr/src/wormhole
ENV WH_ROOT=$WH_ROOT
COPY tools/build.sh tools/go.* $WH_ROOT/tools/
WORKDIR $WH_ROOT/tools
ENV  CGO_ENABLED=0
RUN ./build.sh

# Cache a build of TypeScript gRPC bindings
FROM node:16-alpine@sha256:004dbac84fed48e20f9888a23e32fa7cf83c2995e174a78d41d9a9dd1e051a20 AS base-node
ARG WH_ROOT=/usr/src/wormhole
# Copy go build artifacts
COPY --from=base-go $WH_ROOT/tools $WH_ROOT/tools
COPY buf.* $WH_ROOT/
COPY proto $WH_ROOT/proto
COPY tools/package.json $WH_ROOT/tools/
COPY tools/package-lock.json $WH_ROOT/tools/
WORKDIR $WH_ROOT/tools
RUN npm ci
WORKDIR $WH_ROOT
RUN tools/bin/buf generate --template buf.gen.web.yaml
WORKDIR $WH_ROOT/ethereum
COPY ethereum .
RUN npm ci && npm run build

# Base with known good Rust toolchain via rustup
FROM rust:1.57-slim as base-rust
ARG WH_EMITTER="11111111111111111111111111111115"
ARG WH_BRIDGE="11111111111111111111111111111116"
ARG WH_ROOT=/usr/src/wormhole
ENV EMITTER_ADDRESS=$WH_EMITTER
ENV BRIDGE_ADDRESS=$WH_BRIDGE
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
  apt-get install -y \
  build-essential \
  clang \
  curl \
  libssl-dev \
  libudev-dev \
  llvm \
  pkg-config \
  zlib1g-dev \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
# it's doing some source somewhere. I need to sort it out
RUN sh -c "$(curl --proto '=https' --tlsv1.2 -sSfL https://sh.rustup.rs)" -- -y --default-toolchain nightly-2021-08-01
ENV PATH="/root/.cargo/bin:${PATH}"
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.8.1/install)"
ENV PATH=$PATH:/root/.local/share/solana/install/active_release/bin
# Solana does a download at the beginning of a *first* build-bpf call. Trigger and layer-cache it explicitly.
RUN cargo init --lib /tmp/decoy-crate && \
  cd /tmp/decoy-crate && cargo build-bpf && \
  rm -rf /tmp/decoy-crate
RUN cargo install wasm-pack --version 0.9.1
# Base with tools for Rust WebAssembly builds
COPY solana $WH_ROOT/solana
WORKDIR $WH_ROOT/solana/pyth2wormhole/program
RUN cargo build-bpf
WORKDIR $WH_ROOT/solana/pyth2wormhole
RUN cargo build -p pyth2wormhole-client
ENV PATH "$PATH:$WH_ROOT/solana/pyth2wormhole/target/debug/"
WORKDIR $WH_ROOT/solana
COPY solana .
# Build wasm binaries for wormhole-sdk
WORKDIR $WH_ROOT/solana/bridge/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm && \
  wasm-pack build --target nodejs -d nodejs -- --features wasm
# Build wasm binaries for Wormhole migration
WORKDIR $WH_ROOT/solana/migration
RUN wasm-pack build --target bundler -d bundler -- --features wasm && \
  wasm-pack build --target nodejs -d nodejs -- --features wasm
# Build wasm binaries for NFT bridge
WORKDIR $WH_ROOT/solana/modules/nft_bridge/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm && \
  wasm-pack build --target nodejs -d nodejs -- --features wasm
# Build wasm binaries for token bridge
WORKDIR $WH_ROOT/solana/modules/token_bridge/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm && \
  wasm-pack build --target nodejs -d nodejs -- --features wasm
# Build wasm-binaries for p2w-sdk
WORKDIR $WH_ROOT/solana/pyth2wormhole/program
RUN wasm-pack build --target bundler -d bundler -- --features wasm && \
  wasm-pack build --target nodejs -d nodejs -- --features wasm

# Final p2w-attest target
FROM python:3.8-alpine as p2w-attest
ARG WH_ROOT=/usr/src/wormhole
WORKDIR $WH_ROOT/third_party/pyth

RUN pip install --no-cache-dir pyyaml==6.0
COPY third_party/pyth/p2w_autoattest.py third_party/pyth/pyth_utils.py ./
COPY --from=base-rust /root/.local/share/solana/install/active_release/bin/solana /usr/bin/solana
COPY --from=base-rust /usr/src/wormhole/solana/pyth2wormhole/target/debug/pyth2wormhole-client /usr/bin/pyth2wormhole-client
RUN addgroup -S pyth && adduser -S pyth -G pyth
RUN chown -R pyth:pyth .
USER pyth
RUN echo "\n\
export PATH=\"\${PATH}:\${HOME}/pyth-client/build\"\n\
export PYTHONPATH=\"\${PYTHONPATH:+\$PYTHONPATH:}\${HOME}/pyth-client\"\n\
" >> ~/profile

# Solidity contracts for Pyth2Wormhole
FROM base-node as eth-base
WORKDIR $WH_ROOT/ethereum
COPY ethereum .
RUN npm ci && npm run build
WORKDIR $WH_ROOT/sdk/js
COPY sdk/js .
# Copy proto bindings for Wormhole SDK
COPY --from=base-node $WH_ROOT/sdk/js/src/proto src/proto
# Copy wasm artifacts for Wormhole SDK
COPY --from=base-rust $WH_ROOT/solana/bridge/program/bundler src/solana/core
COPY --from=base-rust $WH_ROOT/solana/migration/bundler src/solana/migration
COPY --from=base-rust $WH_ROOT/solana/modules/nft_bridge/program/bundler src/solana/nft
COPY --from=base-rust $WH_ROOT/solana/modules/token_bridge/program/bundler src/solana/token
COPY --from=base-rust $WH_ROOT/solana/bridge/program/nodejs src/solana/core-node
COPY --from=base-rust $WH_ROOT/solana/migration/nodejs src/solana/migration-node
COPY --from=base-rust $WH_ROOT/solana/modules/nft_bridge/program/nodejs src/solana/nft-node
COPY --from=base-rust $WH_ROOT/solana/modules/token_bridge/program/nodejs src/solana/token-node
RUN npm ci
WORKDIR $WH_ROOT/third_party/pyth/p2w-sdk
# Copy wasm artifacts for Pyth2Wormhole SDK
COPY --from=base-rust $WH_ROOT/solana/pyth2wormhole/program/bundler src/solana/p2w-core
COPY --from=base-rust $WH_ROOT/solana/bridge/program/bundler src/solana/wormhole-core
COPY third_party/pyth/p2w-sdk .
RUN npm ci && npm run build
WORKDIR $WH_ROOT/third_party/pyth/p2w-relay
COPY third_party/pyth/p2w-relay .
RUN npm ci && npm run build

FROM node:16-alpine as p2w-relay
ARG WH_ROOT=/usr/src/wormhole
ENV WH_ROOT=$WH_ROOT
COPY --from=eth-base $WH_ROOT $WH_ROOT
WORKDIR $WH_ROOT/third_party/pyth/p2w-relay
RUN addgroup -S pyth && adduser -S pyth -G pyth
RUN chown -R pyth:pyth .
USER pyth
RUN echo "\n\
export PATH=\"\${PATH}:\${HOME}/pyth-client/build\"\n\
export PYTHONPATH=\"\${PYTHONPATH:+\$PYTHONPATH:}\${HOME}/pyth-client\"\n\
" >> ~/profile
