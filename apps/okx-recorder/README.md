# OKX Recorder

Subscribes to OKX perpetual-swap market data over the public websocket
(`wss://ws.okx.com:8443/ws/v5/public`) for a configurable instrument list and
persists **every** update to ClickHouse. Currently records the top-of-book
(`bbo-tbt`) lane; trades and funding lanes bolt onto the same pipeline.

## What it records

One websocket connection multiplexes a `bbo-tbt` subscription per configured
instrument. Each update is converted to a row and written to
`default.okx_book_ticker`. The payload carries an exchange timestamp (`ts`),
recorded as `ts`; the recorder additionally stamps a client-side `received_at`
when the frame arrives (so transport latency is measurable) and uses OKX's
per-instrument `seqId` as the ordering tiebreaker. There is **no in-memory
dedupe** (a deliberate deviation from `binance-recorder`): every received update
is inserted, and ClickHouse's `ReplacingMergeTree` owns row identity via the
table's ORDER BY keys, collapsing byte-identical insert retries at merge time.

The seeded instruments are the pre-launch AI-lab perpetuals on OKX:
`OPENAI-USDT-SWAP, ANTHROPIC-USDT-SWAP`. Instruments are config-driven only —
adding an OKX perp is a config change, no code change.

> OKX rejects a subscribe for an instrument that doesn't exist with an error
> event; the recorder logs it and the instrument shows up as **perpetual
> staleness** in `/ready` rather than a crash. Verify each instrument is
> actually listed on OKX before relying on its data.

## Quick start (local dev)

1. Copy the sample config and (optionally) the env file:

   ```bash
   cp config.sample.yml config.yml
   cp .env.sample .env
   ```

   No API key is required — OKX's public websocket channels are unauthenticated.

2. Start the full stack with Tilt:

   ```bash
   tilt up
   ```

   This starts ClickHouse, the recorder, Prometheus, and Grafana.

3. Verify data is flowing and the endpoints are live:

   ```bash
   bash scripts/local_e2e_check.sh
   ```

   The check confirms rows have landed in `default.okx_book_ticker` and that
   `/ready` and `/metrics` respond.

## Services & ports

| Service    | Port  | Description                |
|------------|-------|----------------------------|
| ClickHouse | 8226  | HTTP interface             |
| ClickHouse | 9104  | Native interface           |
| Recorder   | 9095  | Prometheus metrics         |
| Recorder   | 8085  | Health endpoints           |
| Prometheus | 9097  | Prometheus UI              |
| Grafana    | 3003  | Dashboards (admin/admin)   |

Grafana auto-provisions a Prometheus datasource and the **OKX Recorder
Overview** dashboard.

## Health & metrics

- `GET /live` (health port) — process liveness.
- `GET /ready` (health port) — ready only when ClickHouse is reachable **and
  every** configured instrument's ToB lane is fresh within
  `ready_stale_seconds`. An instrument that never streams therefore keeps
  `/ready` red, surfacing the gap rather than masking it. Future trades/funding
  lanes expose last-event-age metrics but **never** gate readiness — trades can
  legitimately go quiet and funding updates on a slow cadence.
- `GET /metrics` (metrics port) — Prometheus exposition, including
  `okx_recorder_ready`, `okx_recorder_clickhouse_up`,
  `okx_recorder_insert_rows_total`, `okx_recorder_insert_latency_seconds`,
  `okx_recorder_insert_attempts_total{status}`, `okx_recorder_queue_depth`,
  `okx_recorder_queue_fill_ratio`, `okx_recorder_queue_drops_total{inst_id}`,
  `okx_recorder_stream_reconnects_total`, and
  `okx_recorder_tob_last_seen_unix_seconds{inst_id}`.

## Configuration

Configuration is loaded from a YAML file (`--config` flag) with environment
variable overrides using the prefix `OKX_RECORDER__` (double-underscore
separator). For example, `OKX_RECORDER__CLICKHOUSE__URL` overrides
`clickhouse.url`, and `OKX_RECORDER__INSTRUMENTS=OPENAI-USDT-SWAP,ANTHROPIC-USDT-SWAP`
(comma list) overrides `instruments`.

See [config.sample.yml](config.sample.yml) for all options:

| Key | Default | Description |
|-----|---------|-------------|
| `instruments` | the 2-instrument seed | OKX instrument ids to subscribe; upper-cased; must be non-empty |
| `ws_url` | `wss://ws.okx.com:8443/ws/v5/public` | OKX public websocket endpoint |
| `clickhouse.url` | _required_ | ClickHouse URL (`http`/`https` → `secure`) |
| `clickhouse.user` / `password` | `default` / "" | Credentials |
| `clickhouse.database` / `book_ticker_table` | `default` / `okx_book_ticker` | Target |
| `metrics_port` | `9095` | Prometheus metrics port |
| `health_port` | `8085` | Health endpoint port |
| `ready_stale_seconds` | `10` | Per-instrument ToB freshness window for `/ready` |
| `queue_max_rows` | `50000` | Bounded mpsc queue capacity (drops past full) |
| `batch_max_rows` | `10000` | Max rows per ClickHouse insert batch |
| `batch_flush_seconds` | `2.0` | Max time before a partial batch is flushed |
| `reconnect_max_backoff_seconds` | `30` | Jittered websocket reconnect backoff ceiling |
| `insert_async` | `true` | Use ClickHouse async inserts |

## Schema

ClickHouse schema is in [`migrations/001-init.sql`](migrations/001-init.sql);
for local dev it is auto-loaded via the ClickHouse Docker entrypoint. For
production, apply it manually against the pyth-analytics cluster.

```sql
CREATE TABLE default.okx_book_ticker
(
    inst_id     LowCardinality(String),
    seq_id      Int64,
    bid_px      Nullable(Decimal(38, 12)),
    bid_qty     Nullable(Decimal(38, 12)),
    ask_px      Nullable(Decimal(38, 12)),
    ask_qty     Nullable(Decimal(38, 12)),
    ts          DateTime64(3),
    received_at DateTime64(3),
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(received_at)
ORDER BY (inst_id, received_at, seq_id)
TTL toDateTime(received_at) + INTERVAL 90 DAY DELETE;
```

- **`ReplacingMergeTree(ingested_at)`** + **`ORDER BY (inst_id, received_at, seq_id)`**
  owns row identity: the recorder does no in-memory dedupe, and insert retries
  (a flush that times out client-side but commits server-side, then is retried
  byte-identical) collapse at merge time because the retried rows land on the
  same ORDER BY key. Because `received_at` is one of those keys, a genuine
  exchange re-send arrives with a new `received_at` and is persisted as a
  distinct row by design.
- **`bid_*`/`ask_*` are `Nullable`** because either book side can be missing on
  `bbo-tbt` when the book is one-sided.
- **`ts`** is the exchange timestamp from the payload; **`received_at`** is the
  client receipt time. The pair makes transport latency (`received_at − ts`)
  measurable.
- **Monthly partitions** with a **90-day TTL** keep storage bounded, consistent
  with the sibling recorders.
