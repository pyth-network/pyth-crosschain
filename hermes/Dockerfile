ARG RUST_VERSION=1.73.0

FROM rust:${RUST_VERSION} AS build

# Install OS packages
RUN apt-get update && apt-get install --yes \
    build-essential curl clang libssl-dev protobuf-compiler

# Set default toolchain
RUN rustup default nightly-2023-07-23

# Build
WORKDIR /src
COPY hermes hermes
COPY pythnet/pythnet_sdk pythnet/pythnet_sdk


WORKDIR /src/hermes

RUN --mount=type=cache,target=/root/.cargo/registry cargo build --release

FROM rust:${RUST_VERSION}

# Copy artifacts from other images
COPY --from=build /src/hermes/target/release/hermes /usr/local/bin/
