use std::time::Instant;

use anyhow::Result;
use chrono::{DateTime, Utc};
use clickhouse::{Client, Row};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::{config::ClickHouseTarget, models::BookTicker};

#[derive(Clone)]
pub struct ClickHouseClient {
    client: Client,
    table: String,
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
            table: format!("{}.{}", target.database, target.table),
        }
    }

    pub async fn ping(&self) -> bool {
        self.client.query("SELECT 1").execute().await.is_ok()
    }

    /// Insert a batch of book-ticker rows. Returns `(rows_written, latency_seconds)`.
    pub async fn insert_batch(
        &self,
        tickers: &[BookTicker],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if tickers.is_empty() {
            return Ok((0, 0.0));
        }

        let start = Instant::now();
        let client = if insert_async {
            self.client
                .clone()
                .with_setting("async_insert", "1")
                .with_setting("wait_for_async_insert", "1")
        } else {
            self.client.clone()
        };

        let mut insert = client.insert::<BookTickerRow>(&self.table).await?;
        for ticker in tickers {
            insert.write(&BookTickerRow::from(ticker)).await?;
        }
        insert.end().await?;

        Ok((tickers.len(), start.elapsed().as_secs_f64()))
    }
}

#[derive(Row, Serialize)]
struct BookTickerRow {
    symbol: String,
    update_id: u64,
    bid_px: i128,
    bid_qty: i128,
    ask_px: i128,
    ask_qty: i128,
    #[serde(with = "clickhouse::serde::chrono::datetime64::millis")]
    received_at: DateTime<Utc>,
}

impl From<&BookTicker> for BookTickerRow {
    fn from(t: &BookTicker) -> Self {
        Self {
            symbol: t.symbol.clone(),
            update_id: t.update_id,
            bid_px: decimal_to_d128(&t.bid_px),
            bid_qty: decimal_to_d128(&t.bid_qty),
            ask_px: decimal_to_d128(&t.ask_px),
            ask_qty: decimal_to_d128(&t.ask_qty),
            received_at: t.received_at,
        }
    }
}

/// Convert a `Decimal` to its `Decimal(38, 12)` (`Decimal128`) wire
/// representation (i128).
///
/// The only realistic failure is `rescale` no-op'ing because the target scale
/// would overflow `rust_decimal`'s 96-bit mantissa — i.e. the input has more
/// than 26 digits left of the decimal point. We log and write 0 in that case
/// rather than losing the whole batch. Mirrors `hyperliquid-recorder`'s helper.
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
