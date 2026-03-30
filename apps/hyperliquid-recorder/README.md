# Hyperliquid Recorder (Rust)

`hyperliquid-recorder` continuously ingests Hyperliquid `StreamL2Book` snapshots
and `StreamData` trades from QuickNode gRPC, then writes them into ClickHouse
for market analysis.

## Features

- Multi-market stream workers with reconnect/backoff.
- Batched ClickHouse ingestion with in-batch dedupe.
- `ReplacingMergeTree(ingested_at)` table keyed by
  `(coin, block_time, block_number, n_levels, n_sig_figs, mantissa)`.
- Prometheus metrics and `/live` + `/ready` endpoints.
- Tilt-based local stack (recorder + local ClickHouse + Prometheus + Grafana).

## Local E2E with Tilt

1. Copy local env:

   ```bash
   cp .env.example .env
   ```

2. Put your QuickNode token and endpoint in `.env`.

3. Start local stack:

   ```bash
   tilt up
   ```

4. Verify health and observability:

   - `http://localhost:8082/live`
   - `http://localhost:8082/ready`
   - `http://localhost:9092/metrics`
   - Prometheus UI: `http://localhost:9093`
   - Grafana UI: `http://localhost:3000` (default login: `admin` / `admin`)
   - Dashboard: `Hyperliquid Recorder Overview` (auto-provisioned)

5. Verify persisted data from inside ClickHouse container:

   ```bash
   docker exec hyperliquid-recorder-clickhouse-local \
     clickhouse-client --user recorder --password recorder \
     -q "SELECT count() FROM pyth_analytics.hyperliquid_l2_snapshots"
   ```

6. Run the local E2E check:

   ```bash
   bash scripts/local_e2e_check.sh
   ```

7. Validate Grafana datasource and dashboard:

   - In Grafana, open **Connections -> Data sources** and confirm `Prometheus` is healthy.
   - Open **Dashboards -> Hyperliquid Recorder Overview** and confirm panels show live values.

## Manual run (without Tilt)

```bash
cargo run
```

With a YAML file:

```bash
cargo run -- --config config.sample.yml
```

## Configuration

Required:

- `HYPERLIQUID_RECORDER__QUICKNODE__ENDPOINT`
- `HYPERLIQUID_RECORDER__QUICKNODE__AUTH_TOKEN`

YAML config file (optional):

- Pass `--config /path/to/config.yml` to load config from YAML.
- See `config.sample.yml` for the schema.
- Environment variables are loaded with prefix `HYPERLIQUID_RECORDER` and `__` path separators.
- Environment variables still override YAML values.

Market configuration:

- Use the `markets` list in YAML (recommended), for example:

  ```yaml
  markets:
    - coin: "BTC"
      n_levels: 20
    - coin: "@142"
      n_levels: 20
      n_sig_figs: 3
      mantissa: 1
  ```
- If omitted, the default market set is `BTC`.

ClickHouse configuration:

- `HYPERLIQUID_RECORDER__CLICKHOUSE__URL` (required unless provided in YAML)
- `HYPERLIQUID_RECORDER__CLICKHOUSE__USER` (default `default`)
- `HYPERLIQUID_RECORDER__CLICKHOUSE__PASSWORD` (default empty)
- `HYPERLIQUID_RECORDER__CLICKHOUSE__DATABASE` (default `pyth_analytics`)
- `HYPERLIQUID_RECORDER__CLICKHOUSE__L2_SNAPSHOTS_TABLE` (default `hyperliquid_l2_snapshots`)
- `HYPERLIQUID_RECORDER__CLICKHOUSE__TRADES_TABLE` (default `hyperliquid_trades`)
