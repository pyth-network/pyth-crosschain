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
                price: Some(price.mantissa_i64()),
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

impl Eq for PriceUpdate {}

impl Ord for PriceUpdate {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        (self.price, self.best_bid_price, self.best_ask_price).cmp(&(
            other.price,
            other.best_bid_price,
            other.best_ask_price,
        ))
    }
}

impl Eq for FundingRateUpdate {}

impl Ord for FundingRateUpdate {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        (
            self.price,
            self.rate,
            self.funding_rate_interval
                .as_ref()
                .map(|duration| (duration.seconds, duration.nanos)),
        )
            .cmp(&(
                other.price,
                other.rate,
                other
                    .funding_rate_interval
                    .as_ref()
                    .map(|duration| (duration.seconds, duration.nanos)),
            ))
    }
}

impl PartialOrd for FundingRateUpdate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl PartialOrd for PriceUpdate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Eq for Update {}

impl Ord for Update {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match (self, other) {
            (Update::PriceUpdate(a), Update::PriceUpdate(b)) => a.cmp(b),
            (Update::FundingRateUpdate(a), Update::FundingRateUpdate(b)) => a.cmp(b),
            (Update::PriceUpdate(_), Update::FundingRateUpdate(_)) => std::cmp::Ordering::Less,
            (Update::FundingRateUpdate(_), Update::PriceUpdate(_)) => std::cmp::Ordering::Greater,
        }
    }
}

impl PartialOrd for Update {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Eq for FeedUpdate {}

// FeedUpdates are ordered first by source_timestamp, then by feed_id, then by update.
impl Ord for FeedUpdate {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        (
            &self.source_timestamp.as_ref().map(|t| (t.seconds, t.nanos)),
            &self.feed_id,
            &self.update,
        )
            .cmp(&(
                &other
                    .source_timestamp
                    .as_ref()
                    .map(|t| (t.seconds, t.nanos)),
                &other.feed_id,
                &other.update,
            ))
    }
}

impl PartialOrd for FeedUpdate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
