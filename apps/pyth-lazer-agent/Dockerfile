FROM rust:slim-bookworm AS builder

RUN apt update && apt install -y curl libssl-dev pkg-config build-essential && apt clean all

ADD apps/pyth-lazer-agent /pyth-lazer-agent
WORKDIR /pyth-lazer-agent

RUN cargo build --release

FROM debian:12-slim

RUN apt update && apt install -y libssl-dev && apt clean all

COPY --from=builder /pyth-lazer-agent/target/release/pyth-lazer-agent /pyth-lazer-agent/
COPY --from=builder /pyth-lazer-agent/config/* /pyth-lazer-agent/config/

ENTRYPOINT ["/pyth-lazer-agent/pyth-lazer-agent"]
