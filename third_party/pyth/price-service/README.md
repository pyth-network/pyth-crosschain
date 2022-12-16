# Pyth Price Service

Pyth price service is a webservice that listens to the Wormhole Network for Pyth price updates and serves them via a
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

Price service depends on a Wormhole spy to stream Pyth messages from the Wormhole Network to it.
[Spy](https://github.com/wormhole-foundation/wormhole/blob/main/node/cmd/spy/spy.go) is a component of a
Wormhole guardian node that joins the Wormhole Network peer-to-peer network and listens to the Wormhole verified
messages and streams the messages that are coming from certain emitters (e.g., Pyth data emitters) to its subscribers.

## Run

To run Pyth price service, you need to have Wormhole spy running. You can simply run both price service
and spy using provided mainnet and testnet docker compose files. To run the mainnet docker
compose file run the following command:

```
docker-compose up -f docker-compose.mainnet.yaml
```

The compose files use a public release of Pyth price service and spy. If you wish to change the
price service, you need to build an image for using it first.

## Build an image

First, build the wasm files from the repo root like below. This command generates the wasm files necessary
for parsing Pyth messages coming from Wormhole.

```
docker buildx build -f Dockerfile.wasm -o type=local,dest=. .
```

Then, build the pyth_price_service docker container from the repo root like so:

```
$ docker buildx build -f third_party/pyth/price-service/Dockerfile.price_service -t pyth_price_service .
```

If you wish to build price service without docker, please follow the instruction of the price service
[`Dockerfile`](./Dockerfile.price_service)
