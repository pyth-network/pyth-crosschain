-- Target ClickHouse cluster: pyth-analytics
--
-- Apply manually against the pyth-analytics cluster for production. For local
-- dev this is auto-loaded by the docker-compose ClickHouse entrypoint (see
-- docker-compose.local.yml).
--
-- Trade prints from OKX's `trades` channel. As on the book table, no
-- in-memory dedupe happens in the recorder: every received print is inserted,
-- and ReplacingMergeTree(ingested_at) owns row identity via the ORDER BY keys.
-- OKX aggregates fills at the same px/ts into one print; `count` is the number
-- of fills aggregated (1 = a single fill) and trade_id is the id of the last
-- fill in the aggregate, so aggregate prints stay distinguishable. Partitions
-- and TTL key on the exchange `ts`, matching the ORDER BY.

CREATE TABLE IF NOT EXISTS default.okx_trades
(
    inst_id     LowCardinality(String),
    trade_id    String,
    px          Decimal(38, 12),
    sz          Decimal(38, 12),
    side        LowCardinality(String),
    count       UInt32,
    ts          DateTime64(3),
    received_at DateTime64(3),
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(ts)
ORDER BY (inst_id, ts, trade_id)
TTL toDateTime(ts) + INTERVAL 90 DAY DELETE;
