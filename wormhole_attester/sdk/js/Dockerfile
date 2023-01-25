FROM node:16-alpine@sha256:004dbac84fed48e20f9888a23e32fa7cf83c2995e174a78d41d9a9dd1e051a20

# Build ETH
WORKDIR /usr/src/ethereum
COPY ethereum/package.json ethereum/package-lock.json ./
RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
    npm ci
COPY ethereum .

# Build Wormhole SDK
WORKDIR /usr/src/sdk/js
COPY sdk/js/package.json sdk/js/package-lock.json ./
RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
    npm ci
COPY sdk/js .

# Build wormhole sdk attester in dir preserving directory structure
WORKDIR /usr/src/wormhole_attester/sdk/js/
COPY wormhole_attester/sdk/js/package.json wormhole_attester/sdk/js/package-lock.json ./
RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
    npm ci
COPY wormhole_attester/sdk .
RUN npm run build-test
