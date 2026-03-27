CREATE DATABASE IF NOT EXISTS pyth_analytics;

CREATE TABLE IF NOT EXISTS pyth_analytics.hyperliquid_l2_snapshots
(
    coin LowCardinality(String),
    block_time DateTime64(3),
    block_number UInt64,
    n_levels UInt16,
    n_sig_figs UInt8 DEFAULT 0,
    mantissa UInt8 DEFAULT 0,
    source_endpoint LowCardinality(String),
    bids Array(Tuple(Decimal64(12), Decimal64(12), UInt32)),
    asks Array(Tuple(Decimal64(12), Decimal64(12), UInt32)),
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(block_time)
ORDER BY (coin, block_time, block_number, n_levels, n_sig_figs, mantissa)
TTL toDateTime(block_time) + INTERVAL 90 DAY DELETE;
