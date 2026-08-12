FROM rust:1.91-slim-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
# Every TLS-touching dependency is pinned to rustls, so no OpenSSL headers are
# needed at build time (unlike binance-recorder, whose SDK pulls native-tls).
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/okx-recorder /usr/local/bin/okx-recorder

CMD ["okx-recorder"]
