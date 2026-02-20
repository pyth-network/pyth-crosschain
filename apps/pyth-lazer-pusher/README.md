# Pyth Lazer Pusher

Push Pyth Lazer price feeds to external systems.

## Crates

| Crate | Description |
|-------|-------------|
| [bulk-trade-pusher](./bulk-trade-pusher/) | Push prices to Bulk Trade validators |
| [bulk-trade-mock-validator](./mock/bulk-trade-mock-validator/) | Mock validator for testing |

Shared libraries:
| Crate | Description |
|-------|-------------|
| pusher-utils | Runtime utilities (graceful shutdown) |
| pusher-base | Lazer client, feed config, base metrics |
| websocket-delivery | Multi-endpoint WebSocket client |

## Build

```bash
cargo build --release -p bulk-pusher -p bulk-trade-mock-validator
```

## Local Dev

```bash
# Start mock validator
cargo run -p bulk-trade-mock-validator -- --port 8080

# Run pusher
cargo run -p bulk-pusher -- --config bulk-trade-pusher/config.example.toml
```
