-- Target ClickHouse cluster: pyth-analytics
--
-- Apply manually against the pyth-analytics cluster for production. For local
-- dev this is auto-loaded by the docker-compose ClickHouse entrypoint (see
-- docker-compose.local.yml).
--
-- Settled funding events from the funding-rate-history REST poller (the
-- SETTLED rate, not the websocket predicted-rate stream). One event per
-- (inst_id, funding_time): every poll re-fetches a trailing history window and
-- re-inserts overlapping rows, and ReplacingMergeTree(ingested_at) collapses
-- the duplicates at merge time, making the poller idempotent with no
-- client-side dedupe. Rates are Decimal(38, 18) — not the ToB table's
-- Decimal(38, 12) — because OKX reports funding rates with up to ~17 decimal
-- places. realized_rate is Nullable because OKX can omit it.

CREATE TABLE IF NOT EXISTS default.okx_funding_rates
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
