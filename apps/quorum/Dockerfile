FROM rust:1.87.0 AS build

# Install OS packages
RUN apt-get update && apt-get install --yes \
    build-essential curl clang libssl-dev

# Build
WORKDIR /src
COPY ./apps/quorum apps/quorum

WORKDIR /src/apps/quorum

RUN --mount=type=cache,target=/root/.cargo/registry cargo build --release

# Copy artifacts from other images
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/apps/quorum/target/release/quorum /usr/local/bin/
