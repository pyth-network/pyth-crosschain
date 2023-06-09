ARG RUST_VERSION=1.66.1

FROM rust:${RUST_VERSION}

RUN apt-get update && apt-get install -qq nodejs npm curl

RUN npm install --global yarn

RUN rustup default ${RUST_VERSION}

ARG SOLANA_VERSION=v1.14.17
RUN curl -sSfL https://release.solana.com/${SOLANA_VERSION}/install > install_solana.sh
RUN sh install_solana.sh
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

RUN --mount=type=cache,target=target cargo install --git https://github.com/coral-xyz/anchor avm --locked --force --target-dir target

ARG ANCHOR_VERSION=0.27.0
RUN --mount=type=cache,target=target CARGO_TARGET_DIR=target avm install ${ANCHOR_VERSION} && avm use ${ANCHOR_VERSION}

# Trigger Anchor's BPF tools download for caching
RUN anchor init decoy-crate
RUN cd decoy-crate && anchor build
RUN rm -rf decoy-crate

WORKDIR message_buffer

# layer-cache cargo deps
ADD Cargo.toml Cargo.lock ./
ADD programs/message_buffer/Cargo.toml programs/message_buffer/
RUN mkdir -p programs/message_buffer/src && touch programs/message_buffer/src/lib.rs
RUN cargo fetch --locked

ADD . .

RUN --mount=type=cache,target=target anchor build -p message_buffer && cp -r target target_tmp
RUN rm -rf target && mv target_tmp target
