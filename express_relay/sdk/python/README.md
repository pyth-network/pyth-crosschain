# Express Relay Python SDK

Utility library for searchers and protocols to interact with the Express Relay API.

The SDK includes searcher-side utilities and protocol-side utilities. The searcher-side utilities include a basic Searcher client for connecting to the Express Relay server as well as an example SimpleSearcher class that provides a simple workflow for assessing and bidding on liquidation opportunities.

# Searcher

## Installation

### poetry

```
$ poetry add express-relay
```

## Quickstart

To run the simple searcher script, navigate to `python/` and run

```
$ poetry run python3 -m express_relay.searcher.examples.simple_searcher --private-key <PRIVATE_KEY_HEX_STRING> --chain-id development --verbose --server-url https://per-staging.dourolabs.app/
```

This simple example runs a searcher that queries the Express Relay liquidation server for available liquidation opportunities and naively submits a bid on each available opportunity.
