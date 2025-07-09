ARG RUST_VERSION=1.88.0

FROM rust:${RUST_VERSION} AS build

# Build
WORKDIR /src
COPY apps/fortuna apps/fortuna
COPY pythnet pythnet
COPY Cargo.lock .
COPY target_chains/ethereum/entropy_sdk/solidity/abis target_chains/ethereum/entropy_sdk/solidity/abis

RUN --mount=type=cache,target=/root/.cargo/registry \
    printf "[workspace]\nresolver = \"2\"\nmembers = [\"apps/fortuna\",\"pythnet/pythnet_sdk\"]" > Cargo.toml && \
    cargo build --release -p fortuna


FROM rust:${RUST_VERSION}
# Copy artifacts from other images
COPY --from=build /src/target/release/fortuna /usr/local/bin/
