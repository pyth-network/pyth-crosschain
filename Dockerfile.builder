FROM node:18.20-slim@sha256:1da7652745e9ba5de396e436aa086588ea50d532540fa3147fbc1957c43a46ab as builder
WORKDIR /usr/src/pyth
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY ./ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
