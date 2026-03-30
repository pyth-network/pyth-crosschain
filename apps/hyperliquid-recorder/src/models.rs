use std::str::FromStr;

use anyhow::{Context, Result};
use rust_decimal::Decimal;
use serde::Deserialize;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketSubscription {
    pub coin: String,
    pub n_levels: u32,
    pub n_sig_figs: Option<u32>,
    pub mantissa: Option<u64>,
}

impl MarketSubscription {
    pub fn dedupe_shape(&self) -> (String, u32, u32, u64) {
        (
            self.coin.clone(),
            self.n_levels,
            self.n_sig_figs.unwrap_or(0),
            self.mantissa.unwrap_or(0),
        )
    }
}

#[derive(Clone, Debug)]
pub struct L2Level {
    pub px: Decimal,
    pub sz: Decimal,
    pub n: u32,
}

#[derive(Clone, Debug)]
pub struct L2Snapshot {
    pub coin: String,
    pub block_time_ms: u64,
    pub block_number: u64,
    pub n_levels: u32,
    pub n_sig_figs: Option<u32>,
    pub mantissa: Option<u64>,
    pub source_endpoint: String,
    pub bids: Vec<L2Level>,
    pub asks: Vec<L2Level>,
}

impl L2Snapshot {
    pub fn dedupe_key(&self) -> (String, u64, u32, u32, u64) {
        (
            self.coin.clone(),
            self.block_number,
            self.n_levels,
            self.n_sig_figs.unwrap_or(0),
            self.mantissa.unwrap_or(0),
        )
    }
}

#[derive(Clone, Debug)]
pub struct TradeRecord {
    pub coin: String,
    pub user: String,
    pub px: Decimal,
    pub sz: Decimal,
    pub side: String,
    pub time_ms: u64,
    pub start_position: Decimal,
    pub dir: String,
    pub closed_pnl: Decimal,
    pub hash: String,
    pub oid: u64,
    pub crossed: bool,
    pub fee: Decimal,
    pub tid: u64,
    pub fee_token: String,
    pub twap_id: Option<u64>,
    pub cloid: Option<String>,
    pub builder: Option<String>,
    pub builder_fee: Option<Decimal>,
    pub liquidation: Option<TradeLiquidation>,
    pub block_number: u64,
    pub source_endpoint: String,
}

impl TradeRecord {
    pub fn dedupe_key(&self) -> (String, u64, String, String, u64, u64, String) {
        (
            self.coin.clone(),
            self.tid,
            self.user.clone(),
            self.side.clone(),
            self.time_ms,
            self.oid,
            self.hash.clone(),
        )
    }
}

#[derive(Clone, Debug)]
pub struct TradeLiquidation {
    pub liquidated_user: String,
    pub mark_px: Decimal,
    pub method: String,
}

pub fn parse_trades_payload(
    payload_json: &str,
    fallback_block_number: u64,
    source_endpoint: &str,
) -> Result<Vec<TradeRecord>> {
    let payload: TradesPayloadRaw =
        serde_json::from_str(payload_json).context("failed to decode trades payload")?;
    let mut records = Vec::new();

    match payload {
        TradesPayloadRaw::Events {
            block_number,
            events,
        } => {
            let block_number = block_number.unwrap_or(fallback_block_number);
            for event in events {
                records.push(event.into_record(block_number, source_endpoint)?);
            }
        }
        TradesPayloadRaw::Trades {
            block_number,
            trades,
        } => {
            let block_number = block_number.unwrap_or(fallback_block_number);
            for trade in trades {
                records.push(trade.into_record("", block_number, source_endpoint)?);
            }
        }
    }

    Ok(records)
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum TradesPayloadRaw {
    Events {
        #[serde(default)]
        block_number: Option<u64>,
        #[serde(default)]
        events: Vec<TradeEventRaw>,
    },
    Trades {
        #[serde(default)]
        block_number: Option<u64>,
        #[serde(default)]
        trades: Vec<TradeRaw>,
    },
}

#[derive(Debug, Deserialize)]
struct TradeEventRaw(String, TradeRaw);

impl TradeEventRaw {
    fn into_record(self, block_number: u64, source_endpoint: &str) -> Result<TradeRecord> {
        self.1.into_record(&self.0, block_number, source_endpoint)
    }
}

#[derive(Debug, Deserialize)]
struct TradeRaw {
    coin: String,
    px: String,
    sz: String,
    side: String,
    time: u64,
    #[serde(rename = "startPosition")]
    start_position: String,
    dir: String,
    #[serde(rename = "closedPnl")]
    closed_pnl: String,
    hash: String,
    oid: u64,
    crossed: bool,
    fee: String,
    tid: u64,
    #[serde(rename = "feeToken")]
    fee_token: String,
    #[serde(rename = "twapId")]
    twap_id: Option<u64>,
    cloid: Option<String>,
    builder: Option<String>,
    #[serde(rename = "builderFee")]
    builder_fee: Option<String>,
    liquidation: Option<TradeLiquidationRaw>,
}

impl TradeRaw {
    fn into_record(
        self,
        user: &str,
        block_number: u64,
        source_endpoint: &str,
    ) -> Result<TradeRecord> {
        Ok(TradeRecord {
            coin: self.coin,
            user: user.to_string(),
            px: parse_decimal(&self.px, "px")?,
            sz: parse_decimal(&self.sz, "sz")?,
            side: self.side,
            time_ms: self.time,
            start_position: parse_decimal(&self.start_position, "startPosition")?,
            dir: self.dir,
            closed_pnl: parse_decimal(&self.closed_pnl, "closedPnl")?,
            hash: self.hash,
            oid: self.oid,
            crossed: self.crossed,
            fee: parse_decimal(&self.fee, "fee")?,
            tid: self.tid,
            fee_token: self.fee_token,
            twap_id: self.twap_id,
            cloid: self.cloid,
            builder: self.builder,
            builder_fee: self
                .builder_fee
                .as_deref()
                .map(|value| parse_decimal(value, "builderFee"))
                .transpose()?,
            liquidation: self.liquidation.map(TryInto::try_into).transpose()?,
            block_number,
            source_endpoint: source_endpoint.to_string(),
        })
    }
}

#[derive(Debug, Deserialize)]
struct TradeLiquidationRaw {
    #[serde(rename = "liquidatedUser")]
    liquidated_user: String,
    #[serde(rename = "markPx")]
    mark_px: String,
    method: String,
}

impl TryFrom<TradeLiquidationRaw> for TradeLiquidation {
    type Error = anyhow::Error;

    fn try_from(raw: TradeLiquidationRaw) -> Result<Self, Self::Error> {
        Ok(Self {
            liquidated_user: raw.liquidated_user,
            mark_px: parse_decimal(&raw.mark_px, "liquidation.markPx")?,
            method: raw.method,
        })
    }
}

fn parse_decimal(value: &str, field: &str) -> Result<Decimal> {
    Decimal::from_str(value).with_context(|| format!("invalid decimal in field {field}: {value}"))
}
