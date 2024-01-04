ARG RUST_VERSION=1.66.1

FROM rust:${RUST_VERSION} AS build

# Set default toolchain
RUN rustup default nightly-2023-07-23

# Build
WORKDIR /src
COPY fortuna fortuna
COPY pythnet pythnet

WORKDIR /src/fortuna

RUN --mount=type=cache,target=/root/.cargo/registry cargo build --release


FROM rust:${RUST_VERSION}
# Copy artifacts from other images
COPY --from=build /src/fortuna/target/release/fortuna /usr/local/bin/
