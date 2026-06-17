FROM rust:1.91-slim-bookworm AS builder

# openssl-sys (pulled transitively via the SDK's native-tls path) needs the
# OpenSSL dev headers and pkg-config at build time; the slim image ships neither.
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/binance-recorder /usr/local/bin/binance-recorder

CMD ["binance-recorder"]
