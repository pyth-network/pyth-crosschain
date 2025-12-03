use crate::publisher_update::feed_update::Update;
use crate::publisher_update::{FeedUpdate, FundingRateUpdate, PriceUpdate};
use crate::state::FeedState;
use ::protobuf::MessageField;
use pyth_lazer_protocol::jrpc::{FeedUpdateParams, UpdateParams};
use pyth_lazer_protocol::FeedKind;
use pyth_lazer_protocol::SymbolState;

pub mod transaction_envelope {
    pub use crate::protobuf::transaction_envelope::*;
}

pub mod transaction {
    pub use crate::protobuf::pyth_lazer_transaction::*;
}

pub mod publisher_update {
    pub use crate::protobuf::publisher_update::*;
}

pub mod governance_instruction {
    pub use crate::protobuf::governance_instruction::*;
}

pub mod state {
    pub use crate::protobuf::state::*;
}

pub mod dynamic_value {
    pub use crate::protobuf::dynamic_value::*;
}

#[allow(rustdoc::broken_intra_doc_links)]
mod protobuf {
    include!(concat!(env!("OUT_DIR"), "/protobuf/mod.rs"));
}

mod convert_dynamic_value;

impl From<FeedUpdateParams> for FeedUpdate {
    fn from(value: FeedUpdateParams) -> Self {
        FeedUpdate {
            feed_id: Some(value.feed_id.0),
            source_timestamp: value.source_timestamp.into(),
            update: Some(value.update.into()),
            special_fields: Default::default(),
        }
    }
}

impl From<UpdateParams> for Update {
    fn from(value: UpdateParams) -> Self {
        match value {
            UpdateParams::PriceUpdate {
                price,
                best_bid_price,
                best_ask_price,
            } => Update::PriceUpdate(PriceUpdate {
                price: price.map(|p| p.mantissa_i64()),
                best_bid_price: best_bid_price.map(|p| p.mantissa_i64()),
                best_ask_price: best_ask_price.map(|p| p.mantissa_i64()),
                special_fields: Default::default(),
            }),
            UpdateParams::FundingRateUpdate {
                price,
                rate,
                funding_rate_interval,
            } => Update::FundingRateUpdate(FundingRateUpdate {
                price: price.map(|p| p.mantissa_i64()),
                rate: Some(rate.mantissa()),
                funding_rate_interval: MessageField::from_option(
                    funding_rate_interval.map(|i| i.into()),
                ),
                special_fields: Default::default(),
            }),
        }
    }
}

impl From<FeedState> for SymbolState {
    fn from(value: FeedState) -> Self {
        match value {
            FeedState::COMING_SOON => SymbolState::ComingSoon,
            FeedState::STABLE => SymbolState::Stable,
            FeedState::INACTIVE => SymbolState::Inactive,
        }
    }
}

impl From<SymbolState> for FeedState {
    fn from(value: SymbolState) -> Self {
        match value {
            SymbolState::ComingSoon => FeedState::COMING_SOON,
            SymbolState::Stable => FeedState::STABLE,
            SymbolState::Inactive => FeedState::INACTIVE,
        }
    }
}

impl From<FeedKind> for state::FeedKind {
    fn from(value: FeedKind) -> Self {
        match value {
            FeedKind::Price => state::FeedKind::PRICE,
            FeedKind::FundingRate => state::FeedKind::FUNDING_RATE,
        }
    }
}

impl From<state::FeedKind> for FeedKind {
    fn from(value: state::FeedKind) -> Self {
        match value {
            state::FeedKind::PRICE => FeedKind::Price,
            state::FeedKind::FUNDING_RATE => FeedKind::FundingRate,
        }
    }
}

impl TryFrom<state::Channel> for pyth_lazer_protocol::api::Channel {
    type Error = anyhow::Error;

    fn try_from(value: state::Channel) -> Result<Self, Self::Error> {
        Ok(match value.kind {
            Some(kind) => match kind {
                state::channel::Kind::Rate(rate) => {
                    pyth_lazer_protocol::api::Channel::FixedRate(rate.try_into()?)
                }
                state::channel::Kind::RealTime(_) => pyth_lazer_protocol::api::Channel::RealTime,
            },
            None => pyth_lazer_protocol::api::Channel::FixedRate(
                pyth_lazer_protocol::time::FixedRate::MIN,
            ),
        })
    }
}

impl From<pyth_lazer_protocol::api::Channel> for state::Channel {
    fn from(value: pyth_lazer_protocol::api::Channel) -> Self {
        let mut result = state::Channel::new();
        match value {
            pyth_lazer_protocol::api::Channel::FixedRate(rate) => {
                result.set_rate(rate.into());
            }
            pyth_lazer_protocol::api::Channel::RealTime => {
                result.set_real_time(::protobuf::well_known_types::empty::Empty::new());
            }
        };
        result
    }
}

impl From<pyth_lazer_protocol::api::MarketSession> for state::MarketSession {
    fn from(value: pyth_lazer_protocol::api::MarketSession) -> Self {
        match value {
            pyth_lazer_protocol::api::MarketSession::Regular => state::MarketSession::REGULAR,
            pyth_lazer_protocol::api::MarketSession::PreMarket => state::MarketSession::PRE_MARKET,
            pyth_lazer_protocol::api::MarketSession::PostMarket => {
                state::MarketSession::POST_MARKET
            }
            pyth_lazer_protocol::api::MarketSession::OverNight => state::MarketSession::OVER_NIGHT,
            pyth_lazer_protocol::api::MarketSession::Closed => state::MarketSession::CLOSED,
        }
    }
}

impl From<state::MarketSession> for pyth_lazer_protocol::api::MarketSession {
    fn from(value: state::MarketSession) -> Self {
        match value {
            state::MarketSession::REGULAR => pyth_lazer_protocol::api::MarketSession::Regular,
            state::MarketSession::PRE_MARKET => pyth_lazer_protocol::api::MarketSession::PreMarket,
            state::MarketSession::POST_MARKET => {
                pyth_lazer_protocol::api::MarketSession::PostMarket
            }
            state::MarketSession::OVER_NIGHT => pyth_lazer_protocol::api::MarketSession::OverNight,
            state::MarketSession::CLOSED => pyth_lazer_protocol::api::MarketSession::Closed,
        }
    }
}
