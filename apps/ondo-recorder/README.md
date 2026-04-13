# Ondo Finance Recorder

Polls the [Ondo Finance soft attestation quote API](https://docs.ondo.finance/api-reference/attestations/request-a-soft-attestation-quote) and persists price quotes to ClickHouse.

## What it records

For each configured token, the recorder probes buy and sell prices at multiple size levels (default: 1, 10, 50, 100 tokens) every second, giving a continuous view of price impact across trade sizes.

## Quick start (local dev)

1. Copy the sample config and set your API key:

   ```bash
   cp config.sample.yml config.yml
   # Edit config.yml and set ondo.api_key, or create .env with ONDO_API_KEY=...
   ```

2. Start the full stack with Tilt:

   ```bash
   tilt up
   ```

   This starts ClickHouse, the recorder, Prometheus, and Grafana.

3. Verify data is flowing:

   ```bash
   bash scripts/local_e2e_check.sh
   ```

## Services & ports

| Service    | Port  | Description                |
|------------|-------|----------------------------|
| ClickHouse | 8224  | HTTP interface             |
| Recorder   | 9093  | Prometheus metrics         |
| Recorder   | 8083  | Health endpoints           |
| Prometheus | 9094  | Prometheus UI              |
| Grafana    | 3001  | Dashboards (admin/admin)   |

## Configuration

Configuration is loaded from a YAML file (`--config` flag) with environment variable overrides using the prefix `ONDO_RECORDER__` (double underscore separator).

See [config.sample.yml](config.sample.yml) for all options.

## Schema management

ClickHouse schema is in `migrations/001-init.sql`. For local dev, this is automatically loaded into ClickHouse via the Docker entrypoint. For production, apply migrations manually.
