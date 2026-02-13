# Bulk Trade Pusher

Pushes Pyth Lazer prices to Bulk Trade validators via WebSocket.

## Config

```bash
cp config.example.toml config.toml
```

Required settings:
- `lazer.access_token` - Pyth Lazer API token
- `bulk.signing_key_path` - Path to Ed25519 key file
- `bulk.oracle_account_pubkey_base58` - Oracle account (whitelisted on Bulk)
- `feeds.subscriptions` - Feed IDs to push

Environment overrides: `BULK_PUSHER__LAZER__ACCESS_TOKEN`, etc.

## Run

```bash
cargo run -p bulk-pusher -- --config config.toml
```

## Docker

```bash
# From repo root
docker build -f apps/pyth-lazer-pusher/bulk-trade-pusher/Dockerfile -t bulk-pusher .
```

## HA

Multiple instances share the same oracle account but use different signing keys. Validators deduplicate by (account, nonce).

## CLI Tools

```bash
cargo run -p bulk-trade-cli -- monitor --tilt     # Monitor cluster
cargo run -p bulk-trade-cli -- keygen             # Generate keypair
cargo run -p bulk-trade-cli -- pubkey key.key     # Show pubkey
```
