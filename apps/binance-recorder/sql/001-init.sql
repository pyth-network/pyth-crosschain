CREATE DATABASE IF NOT EXISTS pyth_analytics;

CREATE TABLE IF NOT EXISTS pyth_analytics.binance_best_bid_ask
(
    symbol LowCardinality(String),
    event_time DateTime64(6),
    book_update_id UInt64,
    bid_px Decimal(38, 12),
    bid_qty Decimal(38, 12),
    ask_px Decimal(38, 12),
    ask_qty Decimal(38, 12),
    source_endpoint LowCardinality(String),
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(event_time)
ORDER BY (symbol, event_time, book_update_id)
TTL toDateTime(event_time) + INTERVAL 90 DAY DELETE;
