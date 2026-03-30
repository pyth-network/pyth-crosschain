use std::time::Instant;

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};

use crate::{
    config::ClickHouseTarget,
    models::{L2Snapshot, TradeRecord},
};

#[derive(Clone)]
pub struct ClickHouseClient {
    http_client: reqwest::Client,
    target: ClickHouseTarget,
}

impl ClickHouseClient {
    pub fn new(target: ClickHouseTarget) -> Self {
        Self {
            http_client: reqwest::Client::new(),
            target,
        }
    }

    pub async fn ensure_schema(&self, retention_days: u16) -> Result<()> {
        self.command(&format!(
            "CREATE DATABASE IF NOT EXISTS {}",
            self.target.database
        ))
        .await?;

        self.command(&format!(
            "
            CREATE TABLE IF NOT EXISTS {}.{}
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
            TTL toDateTime(block_time) + INTERVAL {retention_days} DAY DELETE
            ",
            self.target.database, self.target.l2_snapshots_table
        ))
        .await?;

        self.command(&format!(
            "
            CREATE TABLE IF NOT EXISTS {}.{}
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
            TTL toDateTime(trade_time) + INTERVAL {retention_days} DAY DELETE
            ",
            self.target.database, self.target.trades_table
        ))
        .await?;
        Ok(())
    }

    pub async fn ping(&self) -> bool {
        match self.command("SELECT 1").await {
            Ok(result) => result.trim() == "1",
            Err(_) => false,
        }
    }

    pub async fn insert_batch(
        &self,
        snapshots: &[L2Snapshot],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if snapshots.is_empty() {
            return Ok((0, 0.0));
        }
        let start = Instant::now();

        let rows = snapshots
            .iter()
            .map(snapshot_to_values)
            .collect::<Vec<_>>()
            .join(",");

        let settings = if insert_async {
            " SETTINGS async_insert=1,wait_for_async_insert=1"
        } else {
            ""
        };

        let query = format!(
            "INSERT INTO {}.{} (coin,block_time,block_number,n_levels,n_sig_figs,mantissa,source_endpoint,bids,asks){settings} VALUES {rows}",
            self.target.database, self.target.l2_snapshots_table
        );
        self.command(&query).await?;
        Ok((snapshots.len(), start.elapsed().as_secs_f64()))
    }

    pub async fn insert_trades_batch(
        &self,
        trades: &[TradeRecord],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if trades.is_empty() {
            return Ok((0, 0.0));
        }
        let start = Instant::now();

        let rows = trades
            .iter()
            .map(trade_to_values)
            .collect::<Vec<_>>()
            .join(",");

        let settings = if insert_async {
            " SETTINGS async_insert=1,wait_for_async_insert=1"
        } else {
            ""
        };

        let query = format!(
            "INSERT INTO {}.{} (coin,user,trade_time,block_number,tid,hash,oid,side,dir,px,sz,start_position,closed_pnl,crossed,fee,fee_token,twap_id,cloid,builder,builder_fee,liquidated_user,liquidation_mark_px,liquidation_method,source_endpoint){settings} VALUES {rows}",
            self.target.database, self.target.trades_table
        );
        self.command(&query).await?;
        Ok((trades.len(), start.elapsed().as_secs_f64()))
    }

    async fn command(&self, sql: &str) -> Result<String> {
        let mut request = self
            .http_client
            .post(format!(
                "{}://{}:{}/?database={}",
                if self.target.secure { "https" } else { "http" },
                self.target.host,
                self.target.port,
                self.target.database
            ))
            .basic_auth(&self.target.username, Some(&self.target.password))
            .body(sql.to_string());

        if self.target.password.is_empty() {
            request = request.basic_auth(&self.target.username, Option::<String>::None);
        }

        let response = request.send().await?;
        let status = response.status();
        let body = response.text().await?;
        if !status.is_success() {
            return Err(anyhow!("clickhouse query failed ({status}): {body}"));
        }
        Ok(body)
    }
}

fn snapshot_to_values(snapshot: &L2Snapshot) -> String {
    let block_time = DateTime::<Utc>::from_timestamp_millis(snapshot.block_time_ms as i64)
        .unwrap_or(DateTime::<Utc>::UNIX_EPOCH)
        .format("%Y-%m-%d %H:%M:%S%.3f");
    let bids = levels_to_ch_array(&snapshot.bids);
    let asks = levels_to_ch_array(&snapshot.asks);
    format!(
        "('{}','{}',{},{},{},{},'{}',{},{})",
        escape(&snapshot.coin),
        block_time,
        snapshot.block_number,
        snapshot.n_levels,
        snapshot.n_sig_figs.unwrap_or(0),
        snapshot.mantissa.unwrap_or(0),
        escape(&snapshot.source_endpoint),
        bids,
        asks
    )
}

fn levels_to_ch_array(levels: &[crate::models::L2Level]) -> String {
    let tuples = levels
        .iter()
        .map(|level| {
            format!(
                "(toDecimal64('{}',12),toDecimal64('{}',12),{})",
                level.px.normalize(),
                level.sz.normalize(),
                level.n
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    format!("[{tuples}]")
}

fn trade_to_values(trade: &TradeRecord) -> String {
    let trade_time = DateTime::<Utc>::from_timestamp_millis(trade.time_ms as i64)
        .unwrap_or(DateTime::<Utc>::UNIX_EPOCH)
        .format("%Y-%m-%d %H:%M:%S%.3f");
    let liquidated_user = trade
        .liquidation
        .as_ref()
        .map(|liquidation| liquidation.liquidated_user.as_str());
    let liquidation_mark_px = trade
        .liquidation
        .as_ref()
        .map(|liquidation| liquidation.mark_px.normalize().to_string());
    let liquidation_method = trade
        .liquidation
        .as_ref()
        .map(|liquidation| liquidation.method.as_str());

    format!(
        "('{}','{}','{}',{},{},'{}',{},'{}','{}',toDecimal64('{}',12),toDecimal64('{}',12),toDecimal64('{}',12),toDecimal64('{}',12),{},toDecimal64('{}',12),'{}',{}, {}, {}, {}, {}, {}, {}, '{}')",
        escape(&trade.coin),
        escape(&trade.user),
        trade_time,
        trade.block_number,
        trade.tid,
        escape(&trade.hash),
        trade.oid,
        escape(&trade.side),
        escape(&trade.dir),
        trade.px.normalize(),
        trade.sz.normalize(),
        trade.start_position.normalize(),
        trade.closed_pnl.normalize(),
        if trade.crossed { 1 } else { 0 },
        trade.fee.normalize(),
        escape(&trade.fee_token),
        nullable_u64(trade.twap_id),
        nullable_string(trade.cloid.as_deref()),
        nullable_string(trade.builder.as_deref()),
        nullable_decimal(trade.builder_fee.as_ref().map(|value| value.normalize().to_string())),
        nullable_string(liquidated_user),
        nullable_decimal(liquidation_mark_px),
        nullable_string(liquidation_method),
        escape(&trade.source_endpoint),
    )
}

fn nullable_string(value: Option<&str>) -> String {
    value
        .map(|value| format!("'{}'", escape(value)))
        .unwrap_or_else(|| "NULL".to_string())
}

fn nullable_decimal(value: Option<String>) -> String {
    value
        .map(|value| format!("toDecimal64('{}',12)", value))
        .unwrap_or_else(|| "NULL".to_string())
}

fn nullable_u64(value: Option<u64>) -> String {
    value
        .map(|value| value.to_string())
        .unwrap_or_else(|| "NULL".to_string())
}

fn escape(value: &str) -> String {
    value.replace('\'', "\\'")
}
