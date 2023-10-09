FROM docker.io/golang:1.20.4@sha256:6dd5c5f8936d7d4487802fb10a77f31b1776740be0fc17ada1acb74ac958f7be AS build

# Install OS packages
RUN apt-get update && apt-get install --yes \
    build-essential curl clang libssl-dev protobuf-compiler

# Install Rust
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --quiet --no-modify-path
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Solana
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.14.17/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Set default toolchain
RUN rustup default nightly-2023-07-23

# Build
WORKDIR /src
COPY hermes hermes
COPY pythnet/pythnet_sdk pythnet/pythnet_sdk


WORKDIR /src/hermes

RUN --mount=type=cache,target=/root/.cargo/registry cargo build --release

FROM docker.io/golang:1.20.4@sha256:6dd5c5f8936d7d4487802fb10a77f31b1776740be0fc17ada1acb74ac958f7be

# Copy artifacts from other images
COPY --from=build /src/hermes/target/release/hermes /usr/local/bin/
