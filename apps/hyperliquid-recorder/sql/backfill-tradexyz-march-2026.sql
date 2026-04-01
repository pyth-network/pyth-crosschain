-- Backfill Trade[XYZ] fills (including liquidation fills) for March 2026.
-- This query is idempotent: it inserts only rows not already present in target.

INSERT INTO {database:Identifier}.{trades_table:Identifier}
(
    coin,
    user,
    trade_time,
    block_number,
    tid,
    hash,
    oid,
    side,
    dir,
    px,
    sz,
    start_position,
    closed_pnl,
    crossed,
    fee,
    fee_token,
    twap_id,
    cloid,
    builder,
    builder_fee,
    liquidated_user,
    liquidation_mark_px,
    liquidation_method,
    source_endpoint
)
WITH source_rows AS
(
    SELECT
        coin,
        address AS user,
        toDateTime64(timestamp, 3, 'UTC') AS trade_time,
        toUInt64(0) AS block_number,
        toUInt64(trade_id) AS tid,
        tx_hash AS hash,
        toUInt64(order_id) AS oid,
        side,
        direction AS dir,
        toDecimal64(toString(price), 12) AS px,
        toDecimal64(toString(size), 12) AS sz,
        toDecimal64(toString(start_position), 12) AS start_position,
        toDecimal64(toString(realized_pnl), 12) AS closed_pnl,
        toBool(crossed) AS crossed,
        toDecimal64(toString(fee), 12) AS fee,
        fee_token,
        twap_id,
        client_order_id AS cloid,
        builder,
        if(
            isNull(builder_fee),
            CAST(NULL, 'Nullable(Decimal64(12))'),
            toDecimal64(toString(builder_fee), 12)
        ) AS builder_fee,
        if(
            ifNull(is_liquidation, 0) = 1,
            address,
            CAST(NULL, 'Nullable(String)')
        ) AS liquidated_user,
        if(
            isNull(liquidation_mark_px),
            CAST(NULL, 'Nullable(Decimal64(12))'),
            toDecimal64(toString(liquidation_mark_px), 12)
        ) AS liquidation_mark_px,
        liquidation_method,
        'reservoir:xyz:perp:all' AS source_endpoint
    FROM s3(
        {s3_url:String},
        {aws_access_key_id:String},
        {aws_secret_access_key:String},
        {aws_session_token:String},
        'Parquet',
        headers('x-amz-request-payer' = 'requester')
    )
    WHERE coin LIKE 'xyz:%'
      AND timestamp >= toDateTime64('2026-03-01 00:00:00', 3, 'UTC')
      AND timestamp < toDateTime64('2026-04-01 00:00:00', 3, 'UTC')
)
SELECT s.*
FROM source_rows AS s
LEFT ANTI JOIN {database:Identifier}.{trades_table:Identifier} AS t
    ON s.coin = t.coin
   AND s.trade_time = t.trade_time
   AND s.tid = t.tid
   AND s.oid = t.oid
   AND s.hash = t.hash
   AND s.user = t.user
   AND s.side = t.side;
