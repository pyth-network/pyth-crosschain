# Bulk Trade Pusher - Production Build
# Build from repo root: docker build -f apps/pyth-lazer-pusher/bulk-trade-pusher/Dockerfile .

ARG RUST_VERSION=1.88.0

FROM rust:${RUST_VERSION} AS build

WORKDIR /src
# `cargo build --locked` refuses to rewrite Cargo.lock, and cargo prunes entries
# for absent workspace members, so every member listed in the root Cargo.toml has
# to be in the context even though only one is built.
COPY Cargo.toml Cargo.lock ./
COPY apps/argus apps/argus
COPY apps/fortuna apps/fortuna
COPY apps/hermes/client/rust apps/hermes/client/rust
COPY apps/pyth-lazer-pusher apps/pyth-lazer-pusher
COPY apps/quorum apps/quorum
COPY lazer/contracts/cardano/cli/rust lazer/contracts/cardano/cli/rust
COPY pythnet/pythnet_sdk pythnet/pythnet_sdk
COPY target_chains/starknet/tools/test_vaas target_chains/starknet/tools/test_vaas

RUN --mount=type=cache,target=/root/.cargo/registry \
    cargo build --locked --release -p bulk-pusher


# Runtime
FROM debian:bookworm-slim

# set git sha and docker tag from build-time args to run-time env in container
ARG GIT_SHA
ARG DOCKER_CHANNEL
ENV GIT_COMMIT=$GIT_SHA
ENV DOCKER_TAG=$DOCKER_CHANNEL

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates bash && \
    rm -rf /var/lib/apt/lists/* && \
    useradd -r -u 1000 appuser

COPY --from=build /src/target/release/bulk-pusher /usr/local/bin/bulk-pusher
COPY apps/pyth-lazer-pusher/bulk-trade-pusher/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY apps/pyth-lazer-pusher/bulk-trade-pusher/config.toml /etc/bulk-pusher/config.toml
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER appuser
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
