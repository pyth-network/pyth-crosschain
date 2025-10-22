# HIP-3 Pusher

`hip-3-pusher` is intended to serve as an oracle updater for
[HIP-3 markets](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals). 

Currently it:
- Sources market data from Hyperliquid, Pyth Lazer, and Pythnet
- Supports KMS for signing oracle updates
- Provides telemetry to Pyth's internal observability system
