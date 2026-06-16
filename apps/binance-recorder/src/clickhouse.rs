use std::time::Instant;

use anyhow::Result;
use chrono::{DateTime, Utc};
use clickhouse::{Client, Row};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::{config::ClickHouseTarget, models::BinanceBestBidAsk};

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

    /// Insert a batch of decoded top-of-book rows. Returns `(rows, latency_secs)`.
    /// A plain buffered insert — the `ReplacingMergeTree` ORDER BY collapses
    /// exact-duplicate frames at the storage layer, so no in-batch dedupe here.
    pub async fn insert_best_bid_ask_batch(
        &self,
        records: &[BinanceBestBidAsk],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if records.is_empty() {
            return Ok((0, 0.0));
        }
        let start = Instant::now();
        let mut insert = self
            .new_insert::<BestBidAskRow>(&self.target.best_bid_ask_table, insert_async)
            .await?;
        for record in records {
            insert.write(&BestBidAskRow::from(record)).await?;
        }
        insert.end().await?;
        Ok((records.len(), start.elapsed().as_secs_f64()))
    }

    async fn new_insert<T>(
        &self,
        table: &str,
        insert_async: bool,
    ) -> Result<clickhouse::insert::Insert<T>>
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
struct BestBidAskRow {
    symbol: String,
    #[serde(with = "clickhouse::serde::chrono::datetime64::micros")]
    event_time: DateTime<Utc>,
    book_update_id: u64,
    bid_px: i128,
    bid_qty: i128,
    ask_px: i128,
    ask_qty: i128,
    source_endpoint: String,
}

impl From<&BinanceBestBidAsk> for BestBidAskRow {
    fn from(r: &BinanceBestBidAsk) -> Self {
        Self {
            symbol: r.symbol.clone(),
            event_time: from_us(r.event_time_us),
            book_update_id: u64::try_from(r.book_update_id).unwrap_or(0),
            bid_px: decimal_to_d128(&r.bid_px),
            bid_qty: decimal_to_d128(&r.bid_qty),
            ask_px: decimal_to_d128(&r.ask_px),
            ask_qty: decimal_to_d128(&r.ask_qty),
            source_endpoint: r.source_endpoint.clone(),
        }
    }
}

/// Convert a `Decimal` to its `Decimal(38, 12)` (`Decimal128`) wire
/// representation (i128).
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

/// SBE event times are microseconds since the Unix epoch. Convert to a
/// `DateTime<Utc>` for the `DateTime64(6)` column, falling back to the epoch on
/// the (practically impossible) out-of-range input.
fn from_us(us: i64) -> DateTime<Utc> {
    DateTime::from_timestamp_micros(us).unwrap_or_else(|| DateTime::from_timestamp_nanos(0))
}
