-- Target ClickHouse cluster: pyth-analytics
--
-- Apply manually against the pyth-analytics cluster for production. For local
-- dev this is auto-loaded by the docker-compose ClickHouse entrypoint (see
-- docker-compose.local.yml).
--
-- No in-memory dedupe happens in the recorder: every received update is
-- inserted, and ReplacingMergeTree(ingested_at) owns row identity via the
-- ORDER BY keys. bid/ask columns are Nullable because either book side can be
-- missing on OKX's bbo-tbt channel (one-sided book). seq_id is Int64 because
-- OKX documents sentinel negative sequence ids.

CREATE TABLE IF NOT EXISTS default.okx_book_ticker
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
