use std::time::Instant;

use anyhow::{anyhow, Result};

use crate::{config::ClickHouseTarget, models::OndoQuote};

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

    pub async fn ping(&self) -> bool {
        match self.command("SELECT 1").await {
            Ok(result) => result.trim() == "1",
            Err(_) => false,
        }
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

        let rows = quotes
            .iter()
            .map(quote_to_values)
            .collect::<Vec<_>>()
            .join(",");

        let settings = if insert_async {
            " SETTINGS async_insert=1,wait_for_async_insert=1"
        } else {
            ""
        };

        let query = format!(
            "INSERT INTO {}.{} (symbol,ticker,chain_id,side,token_amount,price,asset_address,polled_at){settings} VALUES {rows}",
            self.target.database, self.target.table
        );
        self.command(&query).await?;
        Ok((quotes.len(), start.elapsed().as_secs_f64()))
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

fn quote_to_values(quote: &OndoQuote) -> String {
    let polled_at = quote.polled_at.format("%Y-%m-%d %H:%M:%S%.3f");
    format!(
        "('{}','{}','{}','{}',toDecimal128('{}',18),toDecimal128('{}',18),'{}','{}')",
        escape(&quote.symbol),
        escape(&quote.ticker),
        escape(&quote.chain_id),
        escape(&quote.side),
        quote.token_amount.normalize(),
        quote.price.normalize(),
        escape(&quote.asset_address),
        polled_at,
    )
}

fn escape(value: &str) -> String {
    value.replace('\'', "\\'")
}
