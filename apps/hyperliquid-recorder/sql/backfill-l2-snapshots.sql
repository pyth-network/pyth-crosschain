-- Backfill L2 snapshots for a single source day/file stream.
-- Input rows must be JSONEachRow with fields:
--   coin String
--   t UInt64 (epoch millis)
--   h UInt64 (block height)
--   bids_raw Array(Tuple(String,String,UInt32))  -- (px, sz, n)
--   asks_raw Array(Tuple(String,String,UInt32))  -- (px, sz, n)
--
-- Parameters:
--   {database:Identifier}
--   {l2_snapshots_table:Identifier}
--   {day_start:String}     e.g. 2026-03-01 00:00:00
--   {day_end:String}       e.g. 2026-03-02 00:00:00
--   {n_levels:UInt16}      e.g. 20
--   {n_sig_figs:UInt8}     e.g. 0
--   {mantissa:UInt8}       e.g. 0
--   {source_endpoint:String}
--
-- This query is idempotent: it inserts only rows not already present in target key.
INSERT INTO {database:Identifier}.{l2_snapshots_table:Identifier} (
    coin,
    block_time,
    block_number,
    n_levels,
    n_sig_figs,
    mantissa,
    source_endpoint,
    bids,
    asks
)
WITH source_rows AS (
    SELECT
        coin,
        toDateTime64(t / 1000.0, 3, 'UTC') AS block_time,
        toUInt64(h) AS block_number,
        toUInt16({n_levels:UInt16}) AS n_levels,
        toUInt8({n_sig_figs:UInt8}) AS n_sig_figs,
        toUInt8({mantissa:UInt8}) AS mantissa,
        {source_endpoint:String} AS source_endpoint,
        arrayMap(
            level -> (
                toDecimal128(tupleElement(level, 1), 12),
                toDecimal128(tupleElement(level, 2), 12),
                toUInt32(tupleElement(level, 3))
            ),
            bids_raw
        ) AS bids,
        arrayMap(
            level -> (
                toDecimal128(tupleElement(level, 1), 12),
                toDecimal128(tupleElement(level, 2), 12),
                toUInt32(tupleElement(level, 3))
            ),
            asks_raw
        ) AS asks
    FROM input(
        'coin String, t UInt64, h UInt64, bids_raw Array(Tuple(String,String,UInt32)), asks_raw Array(Tuple(String,String,UInt32))'
    )
    WHERE block_time >= toDateTime64({day_start:String}, 3, 'UTC')
      AND block_time < toDateTime64({day_end:String}, 3, 'UTC')
)
SELECT s.*
FROM source_rows AS s
LEFT ANTI JOIN {database:Identifier}.{l2_snapshots_table:Identifier} AS t
    ON s.coin = t.coin
   AND s.block_time = t.block_time
   AND s.block_number = t.block_number
   AND s.n_levels = t.n_levels
   AND s.n_sig_figs = t.n_sig_figs
   AND s.mantissa = t.mantissa
   AND t.block_time >= toDateTime64({day_start:String}, 3, 'UTC')
   AND t.block_time < toDateTime64({day_end:String}, 3, 'UTC')
FORMAT JSONEachRow
