# Pyth price pusher

Pyth price pusher is a service that regularly pushes updates to the on-chain Pyth price based on configurable conditions.

## Background

Pyth is a cross-chain oracle that streams price updates over the peer-to-peer [Wormhole Network](https://wormholenetwork.com/).
These price updates can be consumed on any chain that has a deployment of the Pyth contract.
By default, Pyth does not automatically update the on-chain price every time the off-chain price changes;
instead, anyone can permissionlessly update the on-chain price prior to using it.
For more information please refer to [this document](https://docs.pyth.network/documentation/how-pyth-works).

Protocols integrating with Pyth can update the on-chain Pyth prices in two different ways.
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

  # Optional block to configure whether this feed can be early updated. If at least one feed meets the
  # triggering conditions above, all other feeds who meet the early update conditions will be included in
  # the submitted batch of prices. This logic takes advantage of the fact that adding a feed to a larger
  # batch of updates incurs a minimal gas cost. All fields below are optional (and interpreted as infinity if omitted)
  # and have the same semantics as the corresponding fields above.
  early_update:
    time_difference: 30
    price_deviation: 0.1
    confidence_ratio: 0.5
- ...
```

By default, the price pusher will automatically update the price of all listed price feeds whenever the
triggering condition for a single feed is met. This behavior takes advantage of the reduced cost of batch price updates
provided by the [Perseus upgrade](https://medium.com/@antonia.vanna.delgado/pyth-network-perseus-first-party-data-matters-e3379bf0d019),
and is typically the lowest cost way to schedule price updates for multiple feeds.

However, if you would like to customize this behavior, you can add an `early_update` section to the YAML configuration file for
the feed.

```yaml
- alias: A/USD # Arbitrary alias for the price feed. It is used in enhance logging.
  ...
  # If provided, only early update this price feed if at least one of the listed triggering conditions is met.
  early_update:
    time_difference: 30
    price_deviation: 0.1
    confidence_ratio: 0.5
```

Two sample YAML configuration files are available in the root of this repo.

You can get the list of available price feeds from
[here](https://pyth.network/developers/price-feed-ids/).

Price pusher communicates with [Hermes][] price service to get the most recent price updates. Hermes listens to the
Pythnet and Wormhole network to get latest price updates, and serves REST and websocket APIs for consumers to fetch the
updates.

NOTE: It is recommended to use stable hermes endpoints. If you are running the price pusher for **Aptos Testnet**, **Sui Testnet**, or **Near Testnet**, we recommend you use beta hermes endpoints.

Pyth hosts [public endpoints](https://docs.pyth.network/price-feeds/api-instances-and-providers/hermes) for Hermes; however, it is recommended to get a private endpoint from one of the
Hermes RPC providers for more reliability. Please refer to [this
document](https://docs.pyth.network/documentation/pythnet-price-feeds/hermes) for more information.

To run the price pusher, please run the following commands, replacing the command line arguments as necessary:

```sh
# Please run the two following commands once from the root of the repo to build the code.
pnpm install
pnpm turbo build --filter @pythnetwork/price-pusher

# Navigate to the price_pusher folder
cd apps/price_pusher

# For EVM
pnpm run start evm --endpoint wss://example-rpc.com \
    --pyth-contract-address 0xff1a0f4744e8582DF...... \
    --price-service-endpoint https://example-hermes-rpc.com \
    --price-config-file "path/to/price-config.beta.sample.yaml" \
    --mnemonic-file "path/to/mnemonic.txt" \
    [--pushing-frequency 10] \
    [--polling-frequency 5] \
    [--override-gas-price-multiplier 1.1]

# For Injective
pnpm run start injective --grpc-endpoint https://grpc-endpoint.com \
    --pyth-contract-address inj1z60tg0... --price-service-endpoint "https://example-hermes-rpc.com" \
    --price-config-file "path/to/price-config.beta.sample.yaml" \
    --mnemonic-file "path/to/mnemonic.txt" \
    --network testnet \
    [--gas-price 160000000] \
    [--gas-multiplier 1.1] \
    [--pushing-frequency 10] \
    [--polling-frequency 5]

# For Aptos
pnpm run start aptos --endpoint https://fullnode.testnet.aptoslabs.com/v1 \
    --pyth-contract-address 0x7e783b349d3e89cf5931af376ebeadbfab855b3fa239b7ada8f5a92fbea6b387 \
    --price-service-endpoint "https://example-hermes-rpc.com" \
    --price-config-file "path/to/price-config.beta.sample.yaml" \
    --mnemonic-file "path/to/mnemonic.txt" \
    [--pushing-frequency 10] \
    [--polling-frequency 5]

# For Sui
pnpm run start sui \
  --endpoint https://sui-testnet-rpc.allthatnode.com \
  --pyth-package-id 0x975e063f398f720af4f33ec06a927f14ea76ca24f7f8dd544aa62ab9d5d15f44 \
  --pyth-state-id 0xd8afde3a48b4ff7212bd6829a150f43f59043221200d63504d981f62bff2e27a \
  --wormhole-package-id 0xcc029e2810f17f9f43f52262f40026a71fbdca40ed3803ad2884994361910b7e \
  --wormhole-state-id 0xebba4cc4d614f7a7cdbe883acc76d1cc767922bc96778e7b68be0d15fce27c02 \
  --price-feed-to-price-info-object-table-id 0xf8929174008c662266a1adde78e1e8e33016eb7ad37d379481e860b911e40ed5 \
  --price-service-endpoint https://example-hermes-rpc.com \
  --mnemonic-file ./mnemonic \
  --price-config-file ./price-config.beta.sample.yaml \
  [--pushing-frequency 10] \
  [--polling-frequency 5] \
  [--num-gas-objects 30]

# For Near
pnpm run start near \
  --node-url https://rpc.testnet.near.org \
  --network testnet \
  --account-id payer.testnet \
  --pyth-contract-address pyth-oracle.testnet \
  --price-service-endpoint "https://hermes-beta.pyth.network" \
  --price-config-file ./price-config.beta.sample.yaml \
  [--private-key-path ./payer.testnet.json] \
  [--pushing-frequency 10] \
  [--polling-frequency 5]

# For Solana, using Jito (recommended)
pnpm run start solana \
  --endpoint https://api.mainnet-beta.solana.com \
  --keypair-file ./id.json \
  --shard-id 1 \
  --jito-endpoint mainnet.block-engine.jito.wtf \
  --jito-keypair-file ./jito.json \
  --jito-tip-lamports 100000 \
  --jito-bundle-size 5 \
  --price-config-file ./price-config.yaml \
  --price-service-endpoint https://hermes.pyth.network/ \
  --pyth-contract-address pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT \
  --pushing-frequency 30 \
  [--polling-frequency 5]

# For Solana, using Solana RPC
pnpm run start solana \
  --endpoint https://api.devnet.solana.com \
  --keypair-file ./id.json \
  --shard-id 1 \
  --price-config-file ./price-config.yaml \
  --price-service-endpoint https://hermes.pyth.network/ \
  --pyth-contract-address pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT \
  --pushing-frequency 30 \
  [--polling-frequency 5]



# Or, run the price pusher docker image instead of building from the source
docker run public.ecr.aws/pyth-network/xc-price-pusher:v<version> -- npm run start -- <above-arguments>
```

[hermes]: https://github.com/pyth-network/pyth-crosschain/tree/main/apps/hermes

### Command Line Arguments

To know more about the arguments the price-pusher accepts. You can run:

```sh
pnpm run start --help

# for specific network run
pnpm run start {network} --help
```

### Logging

By default, the logging is set to `info`. You can change the logging level by passing the argument `--log-level` with the desired level.
The available levels are `error`, `warn`, `info`, `debug`, and `trace`. Also, the logs have JSON format. If you wish to run the code with
human-readable logs, you can pipe the output of the program to `pino-pretty`. See the example below for more information on how to do this.

You can configure the log level of some of the modules of the price pusher as well. The available modules are PriceServiceConnection, which
is responsible for connecting to the Hermes price service, and Controller, which is responsible for checking the prices from the Hermes
and the on-chain Pyth contract and deciding whether to push a new price. You can configure the log level of these modules by passing the
`--price-service-connection-log-level` and `--controller-log-level` arguments, respectively.

### Example

For example, to push `BTC/USD` and `BNB/USD` prices on Fantom testnet, run the following command:

```sh
pnpm run dev evm \
  --endpoint https://endpoints.omniatech.io/v1/fantom/testnet/public \
  --pyth-contract-address 0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb \
  --price-service-endpoint https://hermes.pyth.network \
  --mnemonic-file "./mnemonic" \
  --price-config-file "./price-config.stable.sample.yaml" \
  | pnpm exec pino-pretty # Make logs human-readable
```

[`price-config.stable.sample.yaml`](./price-config.stable.sample.yaml) contains configuration for `BTC/USD`
and `BNB/USD` price feeds on Pyth stable data sources. [`price-config.beta.sample.yaml`](./price-config.beta.sample.yaml)
contains the same configuration for `BTC/USD` and `BNB/USD` on Pyth beta data sources.

You can also provide a config file instead of providing command line options, run the following command:

```sh
pnpm run start injective --config "./config.injective.sample.json"
```

[`config.injective.sample.json`](./config.injective.sample.json) contains configuration to publish on Injective testnet.

## Running via docker-compose

This directory contains sample docker compose files ([stable](./docker-compose.stable.sample.yaml),
[beta](./docker-compose.beta.sample.yaml)) a price pusher.

To run the services via docker-compose, please set the RPC endpoint and contract address of your target network in the
sample docker-compose file.

Then, start the docker-compose like this:

```
docker-compose -f docker-compose.stable.sample.yaml up
```

It will take a few minutes until all the services are up and running.

## Reliability

You can run multiple instances of the price pusher to increase the reliability. It is better to use
different RPCs to get better reliability in case an RPC goes down. **If you use the same payer account
in different pushers, then due to blockchains nonce or sequence for accounts, a transaction won't be
pushed twice and you won't pay additional costs most of the time.** However, there might be some race
conditions in the RPCs because they are often behind a load balancer which can sometimes cause rejected
transactions to land on-chain. You can reduce the chances of additional cost overhead by reducing the
pushing frequency.
