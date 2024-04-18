# The rust version itself is not so important as we install a fixed
# nightly version. We use the latest stable version to get the latest
# updates and dependencies.
FROM rust:1.77.0 AS build

# Install OS packages
RUN apt-get update && apt-get install --yes \
    build-essential curl clang libssl-dev protobuf-compiler

# Set default toolchain
RUN rustup default nightly-2024-03-26

# Build
WORKDIR /src
COPY apps/hermes apps/hermes
COPY pythnet/pythnet_sdk pythnet/pythnet_sdk


WORKDIR /src/apps/hermes

RUN --mount=type=cache,target=/root/.cargo/registry cargo build --release

FROM rust:1.77.0

# Copy artifacts from other images
COPY --from=build /src/apps/hermes/target/release/hermes /usr/local/bin/
