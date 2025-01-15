# Argus

Argus is a webservice that serves price updates according to the Pulse protocol.
The service also operates a keeper task that performs callback transactions for user requests.

A single instance of this service can simultaneously serve price updates for several different blockchains.
Each blockchain is configured in `config.yaml`.

## How It Works

1. Continuously polls the Pulse contract's storage to discover new price update requests
2. Fetches required price data from Pyth Network
3. Batches multiple requests when possible for gas efficiency
4. Executes callbacks with appropriate gas limits specified in the original requests
5. Monitors transaction success and handles retries when necessary

## Architecture

The service is built on Rust for performance and reliability, sharing architectural patterns with Fortuna (the Entropy protocol's keeper service). However, unlike Fortuna which relies on event subscriptions, Argus uses direct storage polling for more reliable request discovery.
