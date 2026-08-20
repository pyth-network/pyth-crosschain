FROM rust:1.89.0 AS build

# Install OS packages
RUN apt-get update && apt-get install --yes \
    build-essential curl clang libssl-dev

# Build
WORKDIR /src
# `cargo build --locked` refuses to rewrite Cargo.lock, and cargo prunes entries
# for absent workspace members, so every member listed in the root Cargo.toml has
# to be in the context even though only one is built.
COPY Cargo.toml Cargo.lock ./
COPY apps/argus apps/argus
COPY apps/fortuna apps/fortuna
COPY apps/hermes/client/rust apps/hermes/client/rust
COPY apps/pyth-lazer-pusher apps/pyth-lazer-pusher
COPY apps/quorum apps/quorum
COPY lazer/contracts/cardano/cli/rust lazer/contracts/cardano/cli/rust
COPY pythnet/pythnet_sdk pythnet/pythnet_sdk
COPY target_chains/starknet/tools/test_vaas target_chains/starknet/tools/test_vaas

RUN --mount=type=cache,target=/root/.cargo/registry \
    cargo build --locked --release -p quorum

# Copy artifacts from other images
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/quorum /usr/local/bin/
