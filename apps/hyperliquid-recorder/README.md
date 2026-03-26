# Hyperliquid Recorder

`hyperliquid-recorder` continuously ingests Hyperliquid `StreamL2Book` snapshots
from QuickNode gRPC and writes them into ClickHouse for market analysis.

## Features

- 24/7 multi-market stream workers with reconnect/backoff.
- Append-only ClickHouse ingestion with local best-effort dedupe.
- `ReplacingMergeTree(ingested_at)` table design keyed by
  `(coin, block_time, block_number, n_levels, n_sig_figs, mantissa)`.
- Prometheus metrics plus `/live` and `/ready` endpoints.
- Tilt-based local stack (recorder + local ClickHouse + Prometheus).

## Local E2E with Tilt (primary workflow)

1. Copy local env:

   ```bash
   cp .env.local.example .env.local
   ```

2. Put your QuickNode token/endpoint in `.env.local`.

3. Start local stack:

   ```bash
   tilt up
   ```

4. Verify health and metrics:

   - `http://localhost:8080/live`
   - `http://localhost:8080/ready`
   - `http://localhost:9091/metrics`
   - Prometheus UI: `http://localhost:9090`

5. Run the local E2E data check:

   ```bash
   python scripts/local_e2e_check.py
   ```

## Manual run (without Tilt)

```bash
pip install -e .
python -m hyperliquid_recorder.main
```

## Configuration

Required:

- `QUICKNODE_GRPC_ENDPOINT`
- `QUICKNODE_GRPC_AUTH_TOKEN`

Market configuration:

- `HYPERLIQUID_MARKETS_JSON` (recommended), for example:

  ```json
  [{"coin":"BTC","n_levels":20},{"coin":"@142","n_levels":20,"n_sig_figs":3,"mantissa":1}]
  ```

ClickHouse configuration:

- local mode: `USE_LOCAL_CLICKHOUSE=true` with `CLICKHOUSE_LOCAL_*`
- remote mode: `CLICKHOUSE_PYTH_ANALYTICS_URL`,
  `CLICKHOUSE_PYTH_ANALYTICS_USERNAME`,
  `CLICKHOUSE_PYTH_ANALYTICS_PASSWORD`

## Table schema

The recorder creates:

- database: `pyth_analytics`
- table: `hyperliquid_l2_snapshots`

See `sql/init-local.sql` for the exact DDL.
