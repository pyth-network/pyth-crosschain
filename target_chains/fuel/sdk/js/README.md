# Pyth Fuel JS

[Pyth](https://pyth.network/) provides real-time pricing data in a variety of asset classes, including cryptocurrency, equities, FX and commodities. This library allows you to use these real-time prices on Fuel network.

## Installation

### npm

```
$ npm install --save @pythnetwork/pyth-fuel-js
```

### Yarn

```
$ yarn add @pythnetwork/pyth-fuel-js
```

## Quickstart

This library is intended to be used in combination with `hermes-client` and `fuels`.

```
$ npm install --save fuels @pythnetwork/hermes-client
```

or

```
$ yarn add fuels @pythnetwork/hermes-client
```

Pyth stores prices off-chain to minimize gas fees, which allows us to offer a wider selection of products and faster update times.
See [On-Demand Updates](https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand) for more information about this approach.
To use Pyth prices on chain,
they must be fetched from a Hermes instance. The `HermesClient` class from Pyth's `hermes-client` library can be used to interact with Hermes,
providing a way to fetch these prices directly in your code.
In order to use Pyth prices in your protocol you need to submit the price update data to Pyth contract in your target
chain.

For a complete example of how to obtain Pyth prices and submit them to a Fuel network, check out the [usage example](src/examples/usage.ts) in the `src/examples` directory.

We strongly recommend reading our guide which explains [how to work with Pyth price feeds](https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices).
