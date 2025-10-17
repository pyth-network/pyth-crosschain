# pyth-lazer-agent

pyth-lazer-agent is intended to be run by Lazer publishers analogous to [pyth-agent](https://github.com/pyth-network/pyth-agent)
for pythnet publishers. Currently, it retains [the existing Lazer publishing interface](https://github.com/pyth-network/pyth-examples/tree/main/lazer/publisher),
but will batch and sign transactions before publishing them to Lazer.

## Keypair

You will need to generate an ed25519 keypair and provide the pubkey to the Lazer team. `solana-keygen` is the recommended utility.
```bash
solana-keygen new -o /path/to/keypair.json
solana-keygen pubkey /path/to/keypair.json
```

pyth-lazer-agent will need to configure access to this keypair file to sign transactions.

## Build and run

### From cargo
```
# Download the cargo package
cargo install pyth-lazer-agent

# Add .cargo/bin to PATH
export PATH="$PATH:~/.cargo/bin"

# Run the agent
pyth-lazer-agent --help
```

### From source
Please check [rust-toolchain](rust-toolchain.toml) to see the version of Rust needed to build (currently 1.88).
You will also need SSL and CA certificates. `cargo build` should then work as usual.

### Docker
See the included [Dockerfile](Dockerfile) to build an image yourself.

### Container
We also publish images to the [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#pulling-container-images).
The latest will be available at `ghcr.io/pyth-network/pyth-lazer-agent:latest`.

## Configure
The agent takes a single `--config` CLI option, pointing at
`config/config.toml` by default. Configuration is currently minimal:

```toml
relayer_urls = ["wss://relayer-0.pyth-lazer.dourolabs.app/v1/transaction", "wss://relayer-1.pyth-lazer.dourolabs.app/v1/transaction"]
publish_keypair_path = "/path/to/keypair.json"
authorization_token = "your_token"
listen_address = "0.0.0.0:8910"
publish_interval_duration = "25ms"
enable_update_deduplication = false
# Optional proxy configuration
# proxy_url = "http://proxy.example.com:8080"
# proxy_url = "http://username:password@proxy.example.com:8080"  # With authentication
```

- `relayers_urls`: The Lazer team will provide these.
- `publish_keypair_path`: The keypair file generated with `solana-keygen` or similar.
- `authorization_token`: The Lazer team will provide this or instruct that it can be omitted.
- `listen_address`: The local port the agent will be listening on; can be anything you want.
- `publisher_interval`: The agent will batch and send transaction bundles at this interval. The Lazer team will provide guidance here.
- `enable_update_deduplication`: The agent will deduplicate updates based inside each batch before sending it to Lazer.
- `proxy_url` (optional): HTTP/HTTPS proxy URL for WebSocket connections. Supports Basic authentication via URL credentials (e.g., `http://user:pass@proxy:port`).
