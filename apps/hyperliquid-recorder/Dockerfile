FROM rust:1.91-slim AS builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock build.rs rust-toolchain.toml ./
COPY proto ./proto
COPY src ./src
RUN cargo build --locked --release

FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/hyperliquid-recorder /usr/local/bin/hyperliquid-recorder

CMD ["hyperliquid-recorder"]
