# Pyth EVM price pusher

Pyth EVM price pusher is a service that regularly pushes updates to the on-chain Pyth price based on configurable conditions.

## Background

Pyth is a cross-chain oracle that streams price updates over the peer-to-peer [Wormhole Network](https://wormholenetwork.com/).
These price updates can be consumed on any chain that has a deployment of the Pyth contract.
By default, Pyth does not automatically update the on-chain price every time the off-chain price changes;
instead, anyone can permissionlessly update the on-chain price prior to using it.
For more information please refer to [this document](../pyth-evm-js/README.md#how-pyth-works-on-evm-chains).

Protocols integrating with can update the on-chain Pyth prices in two different ways.
The first approach is on-demand updates: package a Pyth price update together with each transaction that depends on it.
On-demand updates minimize latency and are more gas efficient, as prices are only updated on-chain when they are needed.

The second approach is to run this service to regularly push updates to the on-chain price.
This approach is useful for protocols that already depend on regular push updates.

## Running Price Pusher

The price pusher service monitors both the off-chain and on-chain Pyth price for a configured set of price feeds.
It then pushes a price update to an on-chain Pyth contract if any of the following conditions are met:

- Time difference: The on-chain price is older than `time_difference` seconds
  from the latest Pyth price.
- Price deviation: The latest Pyth price feed has changed more than `price_deviation` percent
  from the on-chain price feed price.
- Confidence ratio: The latest Pyth price feed has confidence to price ratio of more than
  `confidence_ratio`.

The parameters above are configured per price feed in a price configuration YAML file. The structure looks like this:

```yaml
- alias: A/USD # Arbitrary alias for the price feed. It is used in enhance logging.
  id: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef # id of a price feed, a 32-byte hex string.
  time_difference: 60 # Time difference threshold (in seconds) to push a newer price feed.
  price_deviation: 0.5 # The price deviation (%) threshold to push a newer price feed.
  confidence_ratio: 1 # The confidence/price (%) threshold to push a newer price feed.
- ...
```

You can get the list of available price feeds from
[here](https://pyth.network/developers/price-feed-ids/).

To run the price pusher, please run the following commands, replacing the command line arguments as necessary:

```sh
npm install # Only run it the first time

npm run start -- --evm-endpoint wss://example-rpc.com --mnemonic-file "path/to/mnemonic.txt" \
    --pyth-contract example_network --price-endpoint https://example-pyth-price.com \
    --price-config-file "path/to/price-config-file.yaml" \
    [--cooldown-duration 10] \
    [--evm-polling-frequency 5]

# Or, run the price pusher docker image instead of building from the source
docker run public.ecr.aws/pyth-network/xc-evm-price-pusher:v<version> -- <above-arguments>
```

### Command Line Arguments

The program accepts the following command line arguments:

- `evm-endpoint`: RPC endpoint URL for the EVM network. If you provide a normal HTTP endpoint,
  the pusher will periodically poll for updates. The polling interval is configurable via the
  `evm-polling-frequency` command-line argument (described below). If you provide a websocket RPC endpoint
  (`ws[s]://...`), the price pusher will use event subscriptions to read the current EVM
  price in addition to polling.
- `mnemonic-file`: Path to payer mnemonic (private key) file.
- `pyth-contract`: The Pyth contract address. Provide the network name on which Pyth is deployed
  or the Pyth contract address if you use a local network.
  You can find the networks on which pyth is live and their corresponding names
  [here](../pyth-evm-js/src/index.ts#L13). An example is `bnb_testnet`.
- `price-endpoint`: Endpoint URL for the price service. You can use
  `https://xc-testnet.pyth.network` for testnet and
  `https://xc-mainnet.pyth.network` for mainnet. It is recommended
  to run a standalone price service for more resiliency.
- `price-config-file`: Path to price configuration YAML file.
- `cooldown-duration` (Optional): The amount of time (in seconds) to wait between pushing
  price updates. It should be greater than the block time of the network, so this
  program confirms the price is updated and does not push it twice. Default: 10 seconds.
- `evm-polling-frequency` (Optional): The frequency to poll price info data from the EVM network
  if the RPC is not a Websocket. It has no effect if the RPC is a Websocket.
  Default: 5 seconds.

### Example

For example, to push `BTC/USD` and `BNB/USD` prices on BNB testnet, run the following command:

```sh
npm run start -- --evm-endpoint "https://data-seed-prebsc-1-s1.binance.org:8545" --mnemonic-file "path/to/mnemonic.txt" \
  --pyth-contract bnb_testnet --price-endpoint https://xc-testnet.pyth.network \
  --price-config-file "price-config.testnet.sample.yaml"
```

[`price-config.testnet.sample.yaml`](./price-config.testnet.sample.yaml) contains configuration for `BTC/USD`
and `BNB/USD` price feeds on Pyth testnet. [`price-config.mainnet.sample.yaml`](./price-config.mainnet.sample.yaml)
contains the same configuration for `BTC/USD` and `BNB/USD` on Pyth mainnet.

## Running using a standalone price service (via docker-compose)

EVM price pusher communicates with [Pyth price service][] to get the most recent price updates. Pyth price service listens to the
Wormhole network to get latest price updates, and serves REST and websocket APIs for consumers to fetch the updates.
Pyth hosts public endpoints for the price service; however, it is recommended to run it standalone to achieve more resiliency and
scalability.

This directory contains sample docker compose files ([testnet](./docker-compose.testnet.sample.yaml),
[mainnet](./docker-compose.mainnet.sample.yaml)) an EVM price pusher and its dependencies, including a
price service and a Wormhole spy. A price service depends on a Wormhole spy. A spy listens to the Wormhole
network and reports all Pyth-related Wormhole messages to the price service.

To run the services via docker-compose, please modify the your target network (testnet, mainnet) sample docker-compose file to adjust
the path to your mnemonic file, the path to your price configuration file, the EVM endpoint, and the Pyth contract address
as necessary.

Then, start the docker-compose like this:

```
docker-compose -f docker-compose.testnet.sample.yaml up
```

It will take a few minutes until all the services are up and running.

[pyth price service]: https://github.com/pyth-network/pyth-crosschain/tree/main/price_service/server
