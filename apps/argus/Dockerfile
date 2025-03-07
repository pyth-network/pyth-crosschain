ARG RUST_VERSION=1.82.0

FROM rust:${RUST_VERSION} AS build

# Build
WORKDIR /src
COPY apps/argus apps/argus
COPY pythnet pythnet
COPY target_chains/ethereum/entropy_sdk/solidity/abis target_chains/ethereum/entropy_sdk/solidity/abis

WORKDIR /src/apps/argus

RUN --mount=type=cache,target=/root/.cargo/registry cargo build --release


FROM rust:${RUST_VERSION}
# Copy artifacts from other images
COPY --from=build /src/apps/argus/target/release/argus /usr/local/bin/
