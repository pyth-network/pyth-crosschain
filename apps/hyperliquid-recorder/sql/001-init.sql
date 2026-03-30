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

CREATE TABLE IF NOT EXISTS pyth_analytics.hyperliquid_trades
(
    coin LowCardinality(String),
    user String,
    trade_time DateTime64(3),
    block_number UInt64,
    tid UInt64,
    hash String,
    oid UInt64,
    side LowCardinality(String),
    dir LowCardinality(String),
    px Decimal64(12),
    sz Decimal64(12),
    start_position Decimal64(12),
    closed_pnl Decimal64(12),
    crossed Bool,
    fee Decimal64(12),
    fee_token LowCardinality(String),
    twap_id Nullable(UInt64),
    cloid Nullable(String),
    builder Nullable(String),
    builder_fee Nullable(Decimal64(12)),
    liquidated_user Nullable(String),
    liquidation_mark_px Nullable(Decimal64(12)),
    liquidation_method Nullable(String),
    source_endpoint LowCardinality(String),
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(trade_time)
ORDER BY (coin, trade_time, block_number, tid, oid, user)
TTL toDateTime(trade_time) + INTERVAL 90 DAY DELETE;
