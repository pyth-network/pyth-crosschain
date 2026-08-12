# OKX Recorder

Subscribes to OKX perpetual-swap market data over the public websocket
(`wss://ws.okx.com:8443/ws/v5/public`) for a configurable instrument list and
persists **every** update to ClickHouse. Records the top-of-book (`bbo-tbt`)
websocket lane and the settled funding-rate REST lane; the trades lane bolts
onto the same pipeline.

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

Alongside the websocket, a REST poller fetches the **settled** funding rate
(`/api/v5/public/funding-rate-history` — not the websocket predicted-rate
stream) per configured instrument every `funding_poll_seconds` and writes it to
`default.okx_funding_rates`. Each poll re-fetches the last
`funding_history_limit` events, so overlapping windows are re-inserted on every
poll; that is deliberate — inserts are idempotent by `(inst_id, funding_time)`
via `ReplacingMergeTree`, and the overlap self-heals short outages. Funding
rows carry the exchange settlement time (`funding_time`) plus a client-side
`received_at`.

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

   The check confirms rows have landed in `default.okx_book_ticker` and
   `default.okx_funding_rates`, that funding rows are unique by
   `(inst_id, funding_time)` after ReplacingMergeTree collapse, and that
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
  `/ready` red, surfacing the gap rather than masking it. The funding lane (and
  the future trades lane) exposes last-event metrics but **never** gates
  readiness — funding settles on an hours-scale cadence and sparseness is
  expected, so its staleness is an alerting signal, not an outage.
- `GET /metrics` (metrics port) — Prometheus exposition, including
  `okx_recorder_ready`, `okx_recorder_clickhouse_up`,
  `okx_recorder_insert_rows_total`, `okx_recorder_insert_latency_seconds`,
  `okx_recorder_insert_attempts_total{status}`, `okx_recorder_queue_depth`,
  `okx_recorder_queue_fill_ratio`, `okx_recorder_queue_drops_total{inst_id}`,
  `okx_recorder_stream_reconnects_total`, and
  `okx_recorder_tob_last_seen_unix_seconds{inst_id}`. The funding lane adds
  `okx_recorder_funding_poll_attempts_total{inst_id,status}`,
  `okx_recorder_funding_insert_attempts_total{status}`,
  `okx_recorder_funding_insert_rows_total`,
  `okx_recorder_funding_insert_latency_seconds`, and
  `okx_recorder_funding_last_event_unix_seconds{inst_id}` (exchange settlement
  time of the newest settled funding event — alert on its age, don't gate on
  it).

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
| `clickhouse.funding_rates_table` | `okx_funding_rates` | Funding lane target table |
| `metrics_port` | `9095` | Prometheus metrics port |
| `health_port` | `8085` | Health endpoint port |
| `ready_stale_seconds` | `10` | Per-instrument ToB freshness window for `/ready` |
| `queue_max_rows` | `50000` | Bounded mpsc queue capacity (drops past full) |
| `batch_max_rows` | `10000` | Max rows per ClickHouse insert batch |
| `batch_flush_seconds` | `2.0` | Max time before a partial batch is flushed |
| `reconnect_max_backoff_seconds` | `30` | Jittered websocket reconnect backoff ceiling |
| `insert_async` | `true` | Use ClickHouse async inserts |
| `funding_history_url` | the OKX public endpoint | Settled funding-rate-history REST endpoint |
| `funding_poll_seconds` | `300` | Funding poll interval; must be >= 60 |
| `funding_history_limit` | `10` | History rows requested per poll (1–100) |

## Schema

ClickHouse schema is in [`migrations/`](migrations/) (one file per table); for
local dev it is auto-loaded via the ClickHouse Docker entrypoint. For
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

```sql
CREATE TABLE default.okx_funding_rates
(
    inst_id       LowCardinality(String),
    funding_time  DateTime64(3),
    funding_rate  Decimal(38, 18),
    realized_rate Nullable(Decimal(38, 18)),
    received_at   DateTime64(3),
    ingested_at   DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(funding_time)
ORDER BY (inst_id, funding_time)
TTL toDateTime(funding_time) + INTERVAL 90 DAY DELETE;
```

- **Idempotent by `(inst_id, funding_time)`**: the poller re-fetches
  overlapping history windows every poll and re-inserts them; the ORDER BY key
  plus `ReplacingMergeTree(ingested_at)` collapses the duplicates at merge
  time. Read with `FINAL` (or aggregate) if pre-merge exactness matters.
- **`Decimal(38, 18)`** (not the ToB table's `Decimal(38, 12)`) because OKX
  reports funding rates with up to ~17 decimal places.
- **`realized_rate` is `Nullable`** because OKX can omit it.
