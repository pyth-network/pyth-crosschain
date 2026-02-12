# Bulk Trade Mock Validator - Production Build
# Build from repo root: docker build -f mock/bulk-trade-mock-validator/Dockerfile .

FROM rust:1.91.1 AS chef
RUN cargo install cargo-chef@0.1.73
WORKDIR /src

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS build

ENV CARGO_INCREMENTAL=0 \
    CARGO_NET_RETRY=10 \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

COPY --from=planner /src/recipe.json recipe.json

# Build dependencies (cached unless Cargo.lock changes)
RUN --mount=type=cache,target=/src/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/ \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    cargo chef cook --release --recipe-path recipe.json -p bulk-trade-mock-validator

# Copy source and build
COPY . .
RUN --mount=type=cache,target=/src/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/ \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    cargo build --release --locked -p bulk-trade-mock-validator && \
    cp ./target/release/bulk-trade-mock-validator /bulk-trade-mock-validator

# Runtime
FROM debian:bookworm-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    useradd -r -u 1000 appuser

COPY --from=build /bulk-trade-mock-validator /usr/local/bin/bulk-trade-mock-validator

USER appuser
ENTRYPOINT ["/usr/local/bin/bulk-trade-mock-validator"]
