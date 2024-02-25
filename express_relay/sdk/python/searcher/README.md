# Pyth Express Relay Searcher Python SDK

Utility library for searchers to interact with the Pyth Express Relay API.

The SDK includes a basic Searcher client for connecting to the Express Relay server as well as an example SimpleSearcher class that provides a simple workflow for assessing and bidding on liquidation opportunities.

## Installation

### pip

### openapi-generator

You can use the `openapi-generator` command line tool to auto generate the types you will need for the client. To install, run

```
$ brew install openapi-generator
```

To generate the types from the Express Relay server, run

```
$ openapi-generator generate -i https://per-staging.dourolabs.app/docs/openapi.json -g python -o schema
```

## Quickstart

To run the simple searcher script, you can run

```
$ python3 -m examples.simple_searcher --private-key <PRIVATE_KEY_HEX_STRING> --chain-id development --verbose --liquidation-server-url https://per-staging.dourolabs.app/         
```

This simple example runs a searcher that queries the Express Relay liquidation server for available liquidation opportunities and naively submits a bid on each available opportunity.