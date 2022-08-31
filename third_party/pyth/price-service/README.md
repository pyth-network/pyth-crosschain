# Pyth Price Service

This service exposes a REST and WS api to provide latest attestation message for a price feed id.

## Build

First, build the wasm container from the repo root:

```
docker buildx build -f Dockerfile.wasm -o type=local,dest=. .
```

Then, build the pyth_price_service docker container from the repo root:

```
$ docker buildx build -f third_party/pyth/price-service/Dockerfile.price_service -t pyth_price_service .
```

Run the spy_guardian docker container in TestNet:

```
$ docker run --platform linux/amd64 --network=host ghcr.io/certusone/guardiand:v2.8.8.1 spy \
--nodeKey /node.key --spyRPC "[::]:7073" \
--bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt \
--network /wormhole/testnet/2/1
```

Or run the spy_guardian docker container in MainNet:
For the MainNet gossip network parameters, see https://github.com/wormhole-foundation/wormhole-networks/blob/master/mainnetv2/info.md

```
$ docker run --platform linux/amd64 -d --network=host ghcr.io/certusone/guardiand:v2.8.8.1 spy \
--nodeKey /node.key --spyRPC "[::]:7073" \
--bootstrap <guardianNetworkBootstrapParameterForMainNet> \
--network <guardianNetworkPathForMainNet> \
```

Then to run the pyth_price_service docker container using a config file called `${HOME}/pyth_price_service/env` and logging to directory `${HOME}/pyth_price_service/logs`, do the
following:

```
$ docker run \
--volume=${HOME}/pyth_price_service:/var/pyth_price_service \
-e PYTH_PRICE_SERVICE_CONFIG=/var/pyth_price_service/env \
--network=host \
pyth_price_service
```

Or, run docker compose in the `third_party/pyth/price-service` directory using the commands below. It will run a spy listening to the Wormhole testnet network and a price service that connects to it. Then the price service will serve the Pyth prices published to the Wormhole testnet network.


```
$ cd third_party/pyth/price-service
$ docker compose up
```
