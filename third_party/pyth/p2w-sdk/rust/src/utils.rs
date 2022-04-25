//! Utility types and functions
use pyth_sdk_solana::state::PriceStatus;

/// Helps add wasm serialization functionality to upstream PriceStatus
#[derive(Copy, Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq,)]
#[repr(u8)]
#[serde(remote = "PriceStatus")]
pub enum P2WPriceStatus {
    Unknown,
    Trading,
    Halted,
    Auction
}
impl From<PriceStatus> for P2WPriceStatus {
    fn from(ps: PriceStatus) -> Self {
        match ps {
            PriceStatus::Unknown => Self::Unknown,
            PriceStatus::Trading => Self::Trading,
            PriceStatus::Halted => Self::Halted,
            PriceStatus::Auction => Self::Auction,
        }
    }
}

impl Into<PriceStatus> for P2WPriceStatus {
    fn into(self) -> PriceStatus {
        match self {
            Self::Unknown => PriceStatus::Unknown,
            Self::Trading => PriceStatus::Trading,
            Self::Halted => PriceStatus::Halted,
            Self::Auction => PriceStatus::Auction,
        }
    }
}

impl Default for P2WPriceStatus {
    fn default() -> Self {
        PriceStatus::default().into()
    }
}
