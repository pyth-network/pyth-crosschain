FROM rust:1.82.0 AS build

# Install OS packages
RUN apt-get update && apt-get install --yes \
    build-essential curl clang libssl-dev protobuf-compiler

# Build
WORKDIR /src
COPY apps/hermes/server apps/hermes/server
COPY pythnet/pythnet_sdk pythnet/pythnet_sdk


WORKDIR /src/apps/hermes/server

RUN --mount=type=cache,target=/root/.cargo/registry cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
# Copy artifacts from other images
COPY --from=build /src/apps/hermes/server/target/release/hermes /usr/local/bin/
