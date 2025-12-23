# HIP-3 Pusher

`hip-3-pusher` is intended to serve as an oracle updater for
[HIP-3 markets](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals). 

Currently it:
- Sources market data from Hyperliquid, Pyth Lazer, and Pythnet
- Supports KMS for signing oracle updates
- Provides telemetry to Pyth's internal observability system

## Prerequisites
#### Required Software 
- Python 3.13 (required)
- [uv](https://docs.astral.sh/uv/)
- Hyperliquid wallet
- Docker (optional, for containerized deployment)

#### Required Accounts & Keys 
- Hyperliquid Account: An Ethereum-style private key for the oracle pusher account
- API Keys:
    - Pyth Pro API key (for Pro price feeds)
    - SEDA API key (optional, if using SEDA feeds)
- AWS KMS (optional): For secure key management if using KMS signing

## Configuration

Create a configuration file by copying the sample:

```bash
cd apps/hip-3-pusher
cp config/config.sample.toml config/config.toml
# Edit config.toml with your settings

- Update Hyperliquid `oracle_pusher_key_path`, feed IDs, and URLs.
- Set `enable_publish = true` once you are ready to send real updates.
- If using KMS, set `kms.enable_kms = true` and provide `aws_kms_key_id_path`.
- If using multisig, set `multisig.enable_multisig = true` and `multisig_address`.

```

## SetUp

### Method 1: Using uv (Recommended)
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

cd apps/hip-3-pusher  

# Install dependencies
uv sync

uv run -m pusher.main -c config/config.toml

# Set custom log level  
LOG_LEVEL=DEBUG uv run -m pusher.main -c config/config.toml
```

### Method 2: Using Docker

```bash
cd apps/hip-3-pusher

# Build from the repository root
docker build -f Dockerfile -t hip-3-pusher .

# Run the container  
docker run --rm \
  -p 9090:9090 \
  -v "$(pwd)/config/config.toml:/app/config/config.toml" \
  -v "/path/to/oracle_pusher_key.txt:/private-key.txt" \
  hip-3-pusher           
```

Make sure to update `oracle_pusher_key_path` in your `config.toml` to match the mounted path (e.g., `/private-key.txt`).

