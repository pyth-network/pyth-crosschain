# syntax=docker.io/docker/dockerfile:1.3@sha256:42399d4635eddd7a9b8a24be879d2f9a930d0ed040a61324cfdf59ef1357b3b2
FROM node:lts-alpine@sha256:2ae9624a39ce437e7f58931a5747fdc60224c6e40f8980db90728de58e22af7c

# npm wants to clone random Git repositories - lovely.
RUN apk add git python make build-base

# Run as user, otherwise, npx explodes.
USER 1000
RUN mkdir -p /home/node/app
RUN mkdir -p /home/node/.npm
WORKDIR /home/node/app

# Only invalidate the npm install step if package.json changed
ADD --chown=node:node package.json .
ADD --chown=node:node package-lock.json .
ADD --chown=node:node .env.test .env

# We want to cache node_modules *and* incorporate it into the final image.
RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
  npm install

ADD --chown=node:node . .

RUN npm run build
