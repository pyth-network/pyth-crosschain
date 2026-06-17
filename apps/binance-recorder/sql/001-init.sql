CREATE TABLE IF NOT EXISTS default.binance_book_ticker
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
