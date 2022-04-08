# Pyth 2 Wormhole API

This service exposes a REST api to provide latest attestation message for a price feed id.

## Build

To build the spy_guardian docker container:

```
$ docker build -f Dockerfile.spy_guardian -t spy_guardian .
```

To build the p2w_api docker container:

```
$ docker build -f Dockerfile.p2w_api -t p2w_api .
```

Run the spy_guardian docker container in TestNet:

```
$ docker run --platform linux/amd64 -d --network=host spy_guardian \
--bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt \
--network /wormhole/testnet/2/1 \
--spyRPC "[::]:7073"
```

Or run the spy_guardian docker container in MainNet:
For the MainNet gossip network parameters, see https://github.com/certusone/wormhole-networks/blob/master/mainnetv2/info.md

```
$ docker run --platform linux/amd64 -d --network=host spy_guardian \
--bootstrap <guardianNetworkBootstrapParameterForMainNet> \
--network <guardianNetworkPathForMainNet> \
--spyRPC "[::]:7073"

```

Then to run the p2w_api docker container using a config file called
${HOME}/p2w_api/env and logging to directory ${HOME}/p2w_api/logs, do the
following:

```
$ docker run \
--volume=${HOME}/p2w_api:/var/p2w_api \
-e p2w_api_CONFIG=/var/p2w_api/env \
--network=host \
-d \
p2w_api
```
