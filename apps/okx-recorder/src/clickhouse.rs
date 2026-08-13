use std::time::Instant;

use anyhow::Result;
use chrono::{DateTime, Utc};
use clickhouse::{Client, Row};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::{
    config::ClickHouseTarget,
    models::{BookTicker, FundingRate, Trade},
};

#[derive(Clone)]
pub struct ClickHouseClient {
    client: Client,
    book_ticker_table: String,
    trades_table: String,
    funding_rates_table: String,
}

impl ClickHouseClient {
    pub fn new(target: ClickHouseTarget) -> Self {
        let scheme = if target.secure { "https" } else { "http" };
        let url = format!("{scheme}://{}:{}", target.host, target.port);

        let mut client = Client::default()
            .with_url(url)
            .with_user(&target.username)
            .with_database(&target.database);
        if !target.password.is_empty() {
            client = client.with_password(&target.password);
        }

        Self {
            client,
            // Bare table names: the client is already scoped to the database
            // via `with_database`, so an insert target must NOT be qualified
            // (a dotted name gets quoted as a single identifier and then
            // prefixed with the connected database, yielding `db.`db.table``).
            book_ticker_table: target.book_ticker_table,
            trades_table: target.trades_table,
            funding_rates_table: target.funding_rates_table,
        }
    }

    pub async fn ping(&self) -> bool {
        self.client.query("SELECT 1").execute().await.is_ok()
    }

    /// Insert a batch of book-ticker rows. Returns `(rows_written, latency_seconds)`.
    pub async fn insert_book_ticker_batch(
        &self,
        tickers: &[BookTicker],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if tickers.is_empty() {
            return Ok((0, 0.0));
        }

        let start = Instant::now();
        let mut insert = self
            .insert_client(insert_async)
            .insert::<BookTickerRow>(&self.book_ticker_table)
            .await?;
        for ticker in tickers {
            insert.write(&BookTickerRow::from(ticker)).await?;
        }
        insert.end().await?;

        Ok((tickers.len(), start.elapsed().as_secs_f64()))
    }

    /// Insert a batch of trade rows. Returns `(rows_written, latency_seconds)`.
    pub async fn insert_trades_batch(
        &self,
        trades: &[Trade],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if trades.is_empty() {
            return Ok((0, 0.0));
        }

        let start = Instant::now();
        let mut insert = self
            .insert_client(insert_async)
            .insert::<TradeRow>(&self.trades_table)
            .await?;
        for trade in trades {
            insert.write(&TradeRow::from(trade)).await?;
        }
        insert.end().await?;

        Ok((trades.len(), start.elapsed().as_secs_f64()))
    }

    /// Insert a batch of settled funding-rate rows. Returns
    /// `(rows_written, latency_seconds)`.
    pub async fn insert_funding_batch(
        &self,
        rates: &[FundingRate],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if rates.is_empty() {
            return Ok((0, 0.0));
        }

        let start = Instant::now();
        let mut insert = self
            .insert_client(insert_async)
            .insert::<FundingRateRow>(&self.funding_rates_table)
            .await?;
        for rate in rates {
            insert.write(&FundingRateRow::from(rate)).await?;
        }
        insert.end().await?;

        Ok((rates.len(), start.elapsed().as_secs_f64()))
    }

    fn insert_client(&self, insert_async: bool) -> Client {
        if insert_async {
            self.client
                .clone()
                .with_setting("async_insert", "1")
                .with_setting("wait_for_async_insert", "1")
        } else {
            self.client.clone()
        }
    }
}

#[derive(Row, Serialize)]
struct BookTickerRow {
    inst_id: String,
    seq_id: i64,
    bid_px: Option<i128>,
    bid_qty: Option<i128>,
    ask_px: Option<i128>,
    ask_qty: Option<i128>,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    ts: DateTime<Utc>,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    received_at: DateTime<Utc>,
}

#[derive(Row, Serialize)]
struct TradeRow {
    inst_id: String,
    trade_id: String,
    px: i128,
    sz: i128,
    side: String,
    count: u32,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    ts: DateTime<Utc>,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    received_at: DateTime<Utc>,
}

impl From<&Trade> for TradeRow {
    fn from(t: &Trade) -> Self {
        Self {
            inst_id: t.inst_id.clone(),
            trade_id: t.trade_id.clone(),
            px: decimal_to_d128(&t.px),
            sz: decimal_to_d128(&t.sz),
            side: t.side.clone(),
            count: t.count,
            ts: t.ts,
            received_at: t.received_at,
        }
    }
}

impl From<&BookTicker> for BookTickerRow {
    fn from(t: &BookTicker) -> Self {
        Self {
            inst_id: t.inst_id.clone(),
            seq_id: t.seq_id,
            bid_px: t.bid_px.as_ref().map(decimal_to_d128),
            bid_qty: t.bid_qty.as_ref().map(decimal_to_d128),
            ask_px: t.ask_px.as_ref().map(decimal_to_d128),
            ask_qty: t.ask_qty.as_ref().map(decimal_to_d128),
            ts: t.ts,
            received_at: t.received_at,
        }
    }
}

#[derive(Row, Serialize)]
struct FundingRateRow {
    inst_id: String,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    funding_time: DateTime<Utc>,
    funding_rate: i128,
    realized_rate: Option<i128>,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    received_at: DateTime<Utc>,
}

impl From<&FundingRate> for FundingRateRow {
    fn from(r: &FundingRate) -> Self {
        Self {
            inst_id: r.inst_id.clone(),
            funding_time: r.funding_time,
            funding_rate: decimal_to_rate_d128(&r.funding_rate),
            realized_rate: r.realized_rate.as_ref().map(decimal_to_rate_d128),
            received_at: r.received_at,
        }
    }
}

/// Convert a `Decimal` to its `Decimal(38, 12)` (`Decimal128`) wire
/// representation (i128).
///
/// The only realistic failure is `rescale` no-op'ing because the target scale
/// would overflow `rust_decimal`'s 96-bit mantissa — i.e. the input has more
/// than 26 digits left of the decimal point. We log and write 0 in that case
/// rather than losing the whole batch. Mirrors `binance-recorder`'s helper.
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

/// Convert a `Decimal` to its `Decimal(38, 18)` (`Decimal128`) wire
/// representation (i128), used by the funding-rate columns: OKX reports
/// funding rates with up to ~17 decimal places, so scale 12 would truncate
/// them. Same failure mode as [`decimal_to_d128`] — a value with more than
/// 20 digits left of the decimal point (impossible for a funding rate) is
/// logged and written as 0.
fn decimal_to_rate_d128(value: &Decimal) -> i128 {
    const SCALE: u32 = 18;
    let mut scaled = *value;
    scaled.rescale(SCALE);
    if scaled.scale() != SCALE {
        tracing::warn!(
            value = %value,
            "Decimal value too large to rescale to Decimal(38, 18); writing 0"
        );
        return 0;
    }
    scaled.mantissa()
}
