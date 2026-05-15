use std::time::Instant;

use anyhow::{Context, Result};
use clickhouse::{Client, Row};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::{config::ClickHouseTarget, models::OndoQuote};

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
        self.client
            .query("SELECT 1")
            .fetch_one::<u8>()
            .await
            .map(|v| v == 1)
            .unwrap_or(false)
    }

    pub async fn insert_quotes_batch(
        &self,
        quotes: &[OndoQuote],
        insert_async: bool,
    ) -> Result<(usize, f64)> {
        if quotes.is_empty() {
            return Ok((0, 0.0));
        }

        let start = Instant::now();
        let mut client = self.client.clone();
        if insert_async {
            client = client
                .with_option("async_insert", "1")
                .with_option("wait_for_async_insert", "1");
        }

        let mut insert = client.insert(&self.table)?;
        for quote in quotes {
            let row = OndoQuoteRow::try_from(quote)
                .with_context(|| format!("encode row for {}", quote.symbol))?;
            insert.write(&row).await?;
        }
        insert.end().await?;

        Ok((quotes.len(), start.elapsed().as_secs_f64()))
    }
}

#[derive(Row, Serialize)]
struct OndoQuoteRow<'a> {
    symbol: &'a str,
    ticker: &'a str,
    chain_id: &'a str,
    side: &'a str,
    token_amount: i128,
    price: i128,
    asset_address: &'a str,
    polled_at: i64,
}

impl<'a> TryFrom<&'a OndoQuote> for OndoQuoteRow<'a> {
    type Error = anyhow::Error;

    fn try_from(q: &'a OndoQuote) -> Result<Self> {
        Ok(Self {
            symbol: &q.symbol,
            ticker: &q.ticker,
            chain_id: &q.chain_id,
            side: &q.side,
            token_amount: decimal_to_scaled_i128(q.token_amount, 18)?,
            price: decimal_to_scaled_i128(q.price, 18)?,
            asset_address: &q.asset_address,
            polled_at: q.polled_at.timestamp_millis(),
        })
    }
}

fn decimal_to_scaled_i128(mut d: Decimal, scale: u32) -> Result<i128> {
    d.rescale(scale);
    if d.scale() != scale {
        anyhow::bail!("decimal {d} cannot rescale to {scale}");
    }
    Ok(d.mantissa())
}
