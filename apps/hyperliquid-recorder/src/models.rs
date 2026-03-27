use rust_decimal::Decimal;

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
