use std::time::Instant;

use anyhow::Result;
use chrono::{DateTime, TimeZone, Utc};
use clickhouse::{Client, Row};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::{
    config::ClickHouseTarget,
    models::{FundingRateRecord, L2Level, L2Snapshot, TradeRecord},
};

#[derive(Clone)]
pub struct ClickHouseClient {
    client: Client,
    target: ClickHouseTarget,
}

impl ClickHouseClient {
    pub fn new(target: ClickHouseTarget) -> Self {
        let url = format!(
            "{}://{}:{}",
            if target.secure { "https" } else { "http" },
            target.host,
            target.port,
        );
        let client = Client::default()
            .with_url(url)
            .with_user(target.username.clone())
            .with_password(target.password.clone())
            .with_database(target.database.clone());
        Self { client, target }
    }

    pub async fn ping(&self) -> bool {
        self.client.query("SELECT 1").execute().await.is_ok()
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
        let mut insert = self
            .new_insert::<L2SnapshotRow>(&self.target.l2_snapshots_table, insert_async)
            .await?;
        for snapshot in snapshots {
            insert.write(&L2SnapshotRow::from(snapshot)).await?;
        }
        insert.end().await?;
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
        let mut insert = self
            .new_insert::<TradeRow>(&self.target.trades_table, insert_async)
            .await?;
        for trade in trades {
            insert.write(&TradeRow::from(trade)).await?;
        }
        insert.end().await?;
        Ok((trades.len(), start.elapsed().as_secs_f64()))
    }

    pub async fn insert_funding_batch(
        &self,
        rates: &[FundingRateRecord],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if rates.is_empty() {
            return Ok((0, 0.0));
        }
        let start = Instant::now();
        let mut insert = self
            .new_insert::<FundingRateRow>(&self.target.funding_rates_table, insert_async)
            .await?;
        for rate in rates {
            insert.write(&FundingRateRow::from(rate)).await?;
        }
        insert.end().await?;
        Ok((rates.len(), start.elapsed().as_secs_f64()))
    }

    async fn new_insert<T>(&self, table: &str, insert_async: bool) -> Result<clickhouse::insert::Insert<T>>
    where
        T: Row,
    {
        let client = if insert_async {
            self.client
                .clone()
                .with_setting("async_insert", "1")
                .with_setting("wait_for_async_insert", "1")
        } else {
            self.client.clone()
        };
        Ok(client.insert::<T>(table).await?)
    }
}

#[derive(Row, Serialize)]
struct L2SnapshotRow {
    coin: String,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    block_time: DateTime<Utc>,
    block_number: u64,
    n_levels: u16,
    n_sig_figs: u8,
    mantissa: u8,
    source_endpoint: String,
    bids: Vec<(i128, i128, u32)>,
    asks: Vec<(i128, i128, u32)>,
}

impl From<&L2Snapshot> for L2SnapshotRow {
    fn from(s: &L2Snapshot) -> Self {
        Self {
            coin: s.coin.clone(),
            block_time: from_ms(s.block_time_ms),
            block_number: s.block_number,
            n_levels: s.n_levels as u16,
            n_sig_figs: s.n_sig_figs.unwrap_or(0) as u8,
            mantissa: s.mantissa.unwrap_or(0) as u8,
            source_endpoint: s.source_endpoint.clone(),
            bids: s.bids.iter().map(level_to_tuple).collect(),
            asks: s.asks.iter().map(level_to_tuple).collect(),
        }
    }
}

#[derive(Row, Serialize)]
struct TradeRow {
    coin: String,
    user: String,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    trade_time: DateTime<Utc>,
    block_number: u64,
    tid: u64,
    hash: String,
    oid: u64,
    side: String,
    dir: String,
    px: i64,
    sz: i64,
    start_position: i64,
    closed_pnl: i64,
    crossed: bool,
    fee: i64,
    fee_token: String,
    twap_id: Option<u64>,
    cloid: Option<String>,
    builder: Option<String>,
    builder_fee: Option<i64>,
    liquidated_user: Option<String>,
    liquidation_mark_px: Option<i64>,
    liquidation_method: Option<String>,
    source_endpoint: String,
}

impl From<&TradeRecord> for TradeRow {
    fn from(t: &TradeRecord) -> Self {
        Self {
            coin: t.coin.clone(),
            user: t.user.clone(),
            trade_time: from_ms(t.time_ms),
            block_number: t.block_number,
            tid: t.tid,
            hash: t.hash.clone(),
            oid: t.oid,
            side: t.side.clone(),
            dir: t.dir.clone(),
            px: decimal_to_d64(&t.px),
            sz: decimal_to_d64(&t.sz),
            start_position: decimal_to_d64(&t.start_position),
            closed_pnl: decimal_to_d64(&t.closed_pnl),
            crossed: t.crossed,
            fee: decimal_to_d64(&t.fee),
            fee_token: t.fee_token.clone(),
            twap_id: t.twap_id,
            cloid: t.cloid.clone(),
            builder: t.builder.clone(),
            builder_fee: t.builder_fee.as_ref().map(decimal_to_d64),
            liquidated_user: t.liquidation.as_ref().map(|l| l.liquidated_user.clone()),
            liquidation_mark_px: t.liquidation.as_ref().map(|l| decimal_to_d64(&l.mark_px)),
            liquidation_method: t.liquidation.as_ref().map(|l| l.method.clone()),
            source_endpoint: t.source_endpoint.clone(),
        }
    }
}

#[derive(Row, Serialize)]
struct FundingRateRow {
    coin: String,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    funding_time: DateTime<Utc>,
    funding_rate: i64,
    premium: Option<i64>,
    source_endpoint: String,
}

impl From<&FundingRateRecord> for FundingRateRow {
    fn from(r: &FundingRateRecord) -> Self {
        Self {
            coin: r.coin.clone(),
            funding_time: from_ms(r.funding_time_ms),
            funding_rate: decimal_to_d64(&r.funding_rate),
            premium: r.premium.as_ref().map(decimal_to_d64),
            source_endpoint: r.source_endpoint.clone(),
        }
    }
}

fn level_to_tuple(level: &L2Level) -> (i128, i128, u32) {
    (decimal_to_d128(&level.px), decimal_to_d128(&level.sz), level.n)
}

/// Convert a `Decimal` to its `Decimal(38, 12)` (`Decimal128`) wire
/// representation (i128). Used by `L2SnapshotRow` since the L2 schema uses
/// `Decimal(38, 12)` for bid/ask prices and sizes.
///
/// The only realistic failure is `rescale` no-op'ing because the target scale
/// would overflow `rust_decimal`'s 96-bit mantissa — i.e. the input has more
/// than 26 digits left of the decimal point. We log and write 0 in that case
/// rather than losing the whole batch.
fn decimal_to_d128(value: &Decimal) -> i128 {
    const SCALE: u32 = 12;
    let mut scaled = *value;
    scaled.rescale(SCALE);
    if scaled.scale() != SCALE {
        tracing::warn!(
            value = %value,
            "Decimal value too large to rescale to Decimal(38, 12); writing 0"
        );
        return 0;
    }
    scaled.mantissa()
}

/// Convert a `Decimal` to its `Decimal(18, 12)` (`Decimal64`) wire
/// representation (i64). Used by `TradeRow` and `FundingRateRow`, which both
/// use `Decimal(18, 12)` in CH. Same failure modes as `decimal_to_d128`, plus
/// the additional `i128 → i64` truncation guard for values that fit
/// `Decimal128` but not `Decimal64`.
fn decimal_to_d64(value: &Decimal) -> i64 {
    const SCALE: u32 = 12;
    let mut scaled = *value;
    scaled.rescale(SCALE);
    if scaled.scale() != SCALE {
        tracing::warn!(
            value = %value,
            "Decimal value too large to rescale to Decimal(18, 12); writing 0"
        );
        return 0;
    }
    match i64::try_from(scaled.mantissa()) {
        Ok(v) => v,
        Err(_) => {
            tracing::warn!(
                value = %value,
                "Decimal value overflows Decimal(18, 12); writing 0"
            );
            0
        }
    }
}

fn from_ms(ms: u64) -> DateTime<Utc> {
    Utc.timestamp_millis_opt(ms as i64)
        .single()
        .unwrap_or_else(|| Utc.timestamp_millis_opt(0).single().unwrap())
}
