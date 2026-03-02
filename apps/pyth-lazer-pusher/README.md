# Pyth Lazer Pusher

Push Pyth Lazer price feeds to external systems.

## Crates

| Crate | Description |
|-------|-------------|
| [bulk-trade-pusher](./bulk-trade-pusher/) | Push prices to Bulk Trade validators |
| [bulk-trade-cli](./bulk-trade-cli/) | Cluster monitoring and key management |
| [bulk-trade-mock-validator](./mock/bulk-trade-mock-validator/) | Mock validator for testing |

Shared libraries:
| Crate | Description |
|-------|-------------|
| pusher-base | Lazer client, feed config, base metrics |
| pusher-utils | Runtime utilities (graceful shutdown) |
| websocket-delivery | Multi-endpoint WebSocket client |

## Build

```bash
cargo build --release -p bulk-pusher -p bulk-trade-cli
```

## Local Dev

```bash
# Start mock validator
cargo run -p bulk-trade-mock-validator -- --port 8080

# Run pusher
cargo run -p bulk-pusher -- --config bulk-trade-pusher/config.example.toml

# Monitor
cargo run -p bulk-trade-cli -- monitor --pushers localhost:9091
```

Or with Tilt (requires k3d):
```bash
k3d cluster create lazer-pusher-dev --config tilt/bulk/k3d-config.yaml
cp tilt/bulk/.env.example tilt/bulk/.env
cd tilt/bulk && tilt up

# Monitor (tilt mode automatically picks up all the instances from tilt)
cargo run -p bulk-trade-cli -- monitor --tilt
```
