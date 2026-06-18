# Binance Recorder

Subscribes to Binance USDⓈ-M futures top-of-book (`<symbol>@bookTicker`) for a
configurable market list via the official [`binance-sdk`](https://docs.rs/binance-sdk)
USDⓈ-M futures websocket-streams client and persists **every** update to ClickHouse.

## What it records

One combined websocket connection multiplexes a `bookTicker` subscription per
configured symbol. Each update is converted to a row and written to
`default.binance_book_ticker`. The futures `bookTicker` payload carries an
exchange event time (`E`), recorded as `event_time`; the recorder additionally
stamps a client-side `received_at` in the receive callback (so transport latency
is measurable) and uses the per-symbol monotonic `update_id` as the ordering
tiebreaker. Every update is persisted; ClickHouse's `ReplacingMergeTree` only
collapses exact re-inserts (e.g. an insert retry), so no genuine quote change is
lost.

The seeded basket is the tokenized equity/commodity USDⓈ-M perpetuals on Binance
futures: `XAUUSDT, XAGUSDT, CLUSDT, BZUSDT, CRCLUSDT, MSTRUSDT, NVDAUSDT, TSLAUSDT, SPCXUSDT`.

> Binance accepts a subscribe for a symbol that isn't listed but never sends data
> for it, so such a symbol shows up as **perpetual staleness** in `/ready` rather
> than an error. Verify each symbol is actually listed on Binance USDⓈ-M futures
> before relying on its data.

## Quick start (local dev)

1. Copy the sample config and (optionally) the env file:

   ```bash
   cp config.sample.yml config.yml
   cp .env.sample .env
   ```

   No API key is required — Binance's USDⓈ-M futures `bookTicker` streams are public.

2. Start the full stack with Tilt:

   ```bash
   tilt up
   ```

   This starts ClickHouse, the recorder, Prometheus, and Grafana.

3. Verify data is flowing and the endpoints are live:

   ```bash
   bash scripts/local_e2e_check.sh
   ```

   The check confirms rows have landed in `default.binance_book_ticker`
   and that `/ready` and `/metrics` respond.

## Services & ports

| Service    | Port  | Description                |
|------------|-------|----------------------------|
| ClickHouse | 8225  | HTTP interface             |
| ClickHouse | 9102  | Native interface           |
| Recorder   | 9094  | Prometheus metrics         |
| Recorder   | 8084  | Health endpoints           |
| Prometheus | 9096  | Prometheus UI              |
| Grafana    | 3002  | Dashboards (admin/admin)   |

Grafana auto-provisions a Prometheus datasource and the **Binance Recorder
Overview** dashboard.

## Health & metrics

- `GET /live` (health port) — process liveness.
- `GET /ready` (health port) — ready only when ClickHouse is reachable **and
  every** configured symbol is fresh within `ready_stale_seconds`. A symbol that
  never streams (one not listed on the venue, or outside its trading hours)
  therefore keeps `/ready` red, surfacing the gap rather than masking it.
- `GET /metrics` (metrics port) — Prometheus exposition, including
  `binance_recorder_ready`, `binance_recorder_clickhouse_up`,
  `binance_recorder_insert_rows_total`, `binance_recorder_insert_latency_seconds`,
  `binance_recorder_insert_attempts_total{status}`, `binance_recorder_queue_depth`,
  `binance_recorder_queue_fill_ratio`, `binance_recorder_queue_drops_total{symbol}`,
  and `binance_recorder_symbol_last_seen_unix_seconds{symbol}`.

## Configuration

Configuration is loaded from a YAML file (`--config` flag) with environment
variable overrides using the prefix `BINANCE_RECORDER__` (double-underscore
separator). For example, `BINANCE_RECORDER__CLICKHOUSE__URL` overrides
`clickhouse.url`, and `BINANCE_RECORDER__MARKETS=XAUUSDT,TSLAUSDT` (comma list)
overrides `markets`.

See [config.sample.yml](config.sample.yml) for all options:

| Key | Default | Description |
|-----|---------|-------------|
| `markets` | the 9-symbol basket | Symbols to subscribe; stored upper-cased, subscribed lower-cased; must be non-empty |
| `clickhouse.url` | _required_ | ClickHouse URL (`http`/`https` → `secure`) |
| `clickhouse.user` / `password` | `default` / "" | Credentials |
| `clickhouse.database` / `table` | `default` / `binance_book_ticker` | Target |
| `metrics_port` | `9094` | Prometheus metrics port |
| `health_port` | `8084` | Health endpoint port |
| `ready_stale_seconds` | `10` | Per-symbol freshness window for `/ready` |
| `queue_max_rows` | `50000` | Bounded mpsc queue capacity (drops past full) |
| `batch_max_rows` | `10000` | Max rows per ClickHouse insert batch |
| `batch_flush_seconds` | `2.0` | Max time before a partial batch is flushed |
| `reconnect_max_backoff_seconds` | `5` | SDK websocket reconnect delay bound |
| `insert_async` | `true` | Use ClickHouse async inserts |

## Schema

ClickHouse schema is in [`migrations/001-init.sql`](migrations/001-init.sql); for local dev it
is auto-loaded via the ClickHouse Docker entrypoint. For production, apply it
manually.

```sql
CREATE TABLE default.binance_book_ticker
(
    symbol      LowCardinality(String),
    update_id   UInt64,
    bid_px      Decimal(38, 12),
    bid_qty     Decimal(38, 12),
    ask_px      Decimal(38, 12),
    ask_qty     Decimal(38, 12),
    event_time  DateTime64(3),
    received_at DateTime64(3),
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(received_at)
ORDER BY (symbol, received_at, update_id)
TTL toDateTime(received_at) + INTERVAL 90 DAY DELETE;
```

- **`ReplacingMergeTree(ingested_at)`** + **`ORDER BY (symbol, received_at, update_id)`**
  makes re-ingest (e.g. a reconnect replay of the same `update_id`) idempotent.
- **`event_time`** is the exchange event time (`E`) from the futures payload;
  **`received_at`** is the client receipt time. The pair makes transport latency
  (`received_at − event_time`) measurable.
- **Monthly partitions** with a **90-day TTL** keep storage bounded, consistent
  with the sibling recorders.
