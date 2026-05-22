-- Add chain_id to the sorting key so that ReplacingMergeTree does not
-- silently deduplicate rows for the same symbol across different chains
-- during background merges.
--
-- ClickHouse does not allow adding an existing column to ORDER BY via
-- ALTER, so we recreate the table and backfill the data.

CREATE TABLE IF NOT EXISTS pyth_analytics.ondo_quotes_v2
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
ORDER BY (symbol, side, token_amount, polled_at, chain_id)
TTL toDateTime(polled_at) + INTERVAL 90 DAY DELETE;

INSERT INTO pyth_analytics.ondo_quotes_v2
    (symbol, ticker, chain_id, side, token_amount, price, asset_address, polled_at, ingested_at)
SELECT symbol, ticker, chain_id, side, token_amount, price, asset_address, polled_at, ingested_at
FROM pyth_analytics.ondo_quotes;

DROP TABLE pyth_analytics.ondo_quotes;

RENAME TABLE pyth_analytics.ondo_quotes_v2 TO pyth_analytics.ondo_quotes;
