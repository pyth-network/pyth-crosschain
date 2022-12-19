# Pyth Price Service

The Pyth price service is a webservice that listens to the Wormhole Network for Pyth price updates and serves them via a
convenient web API. The service allows users to easily query for recent price updates via a REST API, or subscribe to
a websocket for streaming updates. [The Pyth Network Javascript SDKs](https://github.com/pyth-network/pyth-js) connect
to an instance of the price service in order to fetch on-demand price updates.

## Public Endpoints

The Pyth Data Association operates two public endpoints for the price service, for mainnet and testnet respectively.
These endpoints can be used to test integrations with Pyth Network:

| network | url                             |
| ------- | ------------------------------- |
| mainnet | https://xc-mainnet.pyth.network |
| testnet | https://xc-testnet.pyth.network |

For production deployments, developers integrating with Pyth Network are **strongly encouraged** to host their own instance of the price service for maximum resilience and decentralization.
By running an independent instance of this service, developers tap directly into Wormhole's peer-to-peer network to stream Pyth price updates.
This peer-to-peer network has built-in redundancy and is therefore inherently more reliable than a centralized service operated by the PDA.

## Wormhole Spy

The price service depends on a Wormhole Spy to stream Pyth messages from the Wormhole Network to it. The
[spy](https://github.com/wormhole-foundation/wormhole/blob/main/node/cmd/spy/spy.go) is a Wormhole component that listens to the Wormhole verified
messages from the Wormhole Network peer-to-peer network; then, it streams the messages that are coming from certain emitters (e.g., Pyth data emitters) to its subscribers.

The price service subscribes to the spy to fetch all verified prices coming from the Pyth data sources. The Pyth data sources should
be defined in `SPY_SERVICE_FILTERS` environment variable as a JSON array.

## Run

This repository contains testnet and mainnet docker-compose files to run
both the price service and spy. To run the mainnet docker compose file run
the following command:

```
docker-compose up -f docker-compose.mainnet.yaml
```

The compose files use a public release of Pyth price service and spy. If you wish to change the
price service you should:

1. Build an image for using it first according to the section below.
2. Change the price service image to your local docker image (e.g., `pyth_price_service`)

## Build an image

First, build the wasm files from [the repo root](../../../) like below. This command generates the wasm files necessary
for parsing Pyth messages coming from Wormhole and stores them on [this](../p2w-sdk/js/src/solana/p2w-core) directory.

```
docker buildx build -f Dockerfile.wasm -o type=local,dest=. .
```

Then, build the image from [the repo root](../../../) like below. It will create a
local image named `pyth_price_service`.

```
$ docker buildx build -f third_party/pyth/price-service/Dockerfile.price_service -t pyth_price_service .
```

If you wish to build price service without docker, please follow the instruction of the price service
[`Dockerfile`](./Dockerfile.price_service)
