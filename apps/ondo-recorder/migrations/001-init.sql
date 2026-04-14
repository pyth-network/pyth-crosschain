CREATE DATABASE IF NOT EXISTS pyth_analytics;

CREATE TABLE IF NOT EXISTS pyth_analytics.ondo_quotes
(
    symbol       LowCardinality(String),
    ticker       LowCardinality(String),
    chain_id     LowCardinality(String),
    side         LowCardinality(String),
    token_amount Decimal128(18),
    price        Decimal128(18),
    asset_address String,
    polled_at    DateTime64(3),
    ingested_at  DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(polled_at)
ORDER BY (symbol, side, token_amount, polled_at)
TTL toDateTime(polled_at) + INTERVAL 90 DAY DELETE;
