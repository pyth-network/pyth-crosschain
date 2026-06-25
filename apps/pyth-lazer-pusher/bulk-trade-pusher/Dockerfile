# Bulk Trade Pusher - Production Build
# Build from repo root: docker build -f apps/pyth-lazer-pusher/bulk-trade-pusher/Dockerfile .

ARG RUST_VERSION=1.88.0

FROM rust:${RUST_VERSION} AS build

WORKDIR /src
COPY apps/pyth-lazer-pusher apps/pyth-lazer-pusher
COPY Cargo.lock .

RUN --mount=type=cache,target=/root/.cargo/registry \
    printf '[workspace]\nresolver = "2"\nmembers = ["apps/pyth-lazer-pusher/pusher-utils","apps/pyth-lazer-pusher/pusher-base","apps/pyth-lazer-pusher/websocket-delivery","apps/pyth-lazer-pusher/bulk-trade-pusher"]\n\n[workspace.lints.rust]\nunsafe_code = "deny"\n\n[workspace.lints.clippy]\nexpect_used = "warn"\nunwrap_used = "warn"\n' > Cargo.toml && \
    cargo build --release -p bulk-pusher


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
