# Pyth Express Relay Python SDK

Utility library for searchers and protocols to interact with the Pyth Express Relay API.

The SDK includes searcher-side utilities and protocol-side utilities. The searcher-side utilities include a basic Searcher client for connecting to the Express Relay server as well as an example SimpleSearcher class that provides a simple workflow for assessing and bidding on liquidation opportunities.

# Searcher

## Installation

### poetry

### openapi-generator

You can use the `openapi-generator` command line tool to auto generate the types you will need for the client. To install, run

```
$ brew install openapi-generator
```

To generate the types from the Express Relay server, run

```
$ openapi-generator generate -i https://per-staging.dourolabs.app/docs/openapi.json -g python --additional-properties=generateSourceCodeOnly=true --global-property models,modelTests=false,modelDocs=false
```

## Quickstart

To run the simple searcher script, navigate to `express_relay_utils/` and run

```
$ python3 -m searcher.examples.simple_searcher --private-key <PRIVATE_KEY_HEX_STRING> --chain-id development --verbose --server-url https://per-staging.dourolabs.app/
```

This simple example runs a searcher that queries the Express Relay liquidation server for available liquidation opportunities and naively submits a bid on each available opportunity.
