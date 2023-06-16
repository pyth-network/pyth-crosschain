#[cfg(feature = "quickcheck")]
use quickcheck::Arbitrary;
use serde::{
    Deserialize,
    Serialize,
};

/// Message format for sending data to other chains via the accumulator program
/// When serialized with PythNet serialization format, each message starts with a unique
/// 1-byte discriminator, followed by the serialized struct data in the definition(s) below.
///
/// Messages are forward-compatible. You may add new fields to messages after all previously
/// defined fields. All code for parsing messages must ignore any extraneous bytes at the end of
/// the message (which could be fields that the code does not yet understand).
///
/// The oracle is not using the Message enum due to the contract size limit and
/// some of the methods for PriceFeedMessage and TwapMessage are not used by the oracle
/// for the same reason. Rust compiler doesn't include the unused methods in the contract.
/// Once we start using the unused structs and methods, the contract size will increase.

#[derive(Debug, Copy, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "strum",
    derive(strum::EnumDiscriminants),
    strum_discriminants(name(MessageType)),
    strum_discriminants(vis(pub)),
    strum_discriminants(derive(
        Hash,
        strum::EnumIter,
        strum::EnumString,
        strum::IntoStaticStr,
        strum::Display,
        Serialize,
        Deserialize
    ))
)]
pub enum Message {
    PriceFeedMessage(PriceFeedMessage),
    TwapMessage(TwapMessage),
}

impl Message {
    pub fn publish_time(&self) -> i64 {
        match self {
            Self::PriceFeedMessage(msg) => msg.publish_time,
            Self::TwapMessage(msg) => msg.publish_time,
        }
    }

    pub fn id(&self) -> [u8; 32] {
        match self {
            Self::PriceFeedMessage(msg) => msg.id,
            Self::TwapMessage(msg) => msg.id,
        }
    }
}

#[cfg(feature = "quickcheck")]
impl Arbitrary for Message {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        match u8::arbitrary(g) % 2 {
            0 => Message::PriceFeedMessage(Arbitrary::arbitrary(g)),
            _ => Message::TwapMessage(Arbitrary::arbitrary(g)),
        }
    }
}


#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq, Serialize, Deserialize)]
pub struct PriceFeedMessage {
    pub id:                [u8; 32],
    pub price:             i64,
    pub conf:              u64,
    pub exponent:          i32,
    /// The timestamp of this price update in seconds
    pub publish_time:      i64,
    /// The timestamp of the previous price update. This field is intended to allow users to
    /// identify the single unique price update for any moment in time:
    /// for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.
    ///
    /// Note that there may not be such an update while we are migrating to the new message-sending logic,
    /// as some price updates on pythnet may not be sent to other chains (because the message-sending
    /// logic may not have triggered). We can solve this problem by making the message-sending mandatory
    /// (which we can do once publishers have migrated over).
    ///
    /// Additionally, this field may be equal to publish_time if the message is sent on a slot where
    /// where the aggregation was unsuccesful. This problem will go away once all publishers have
    /// migrated over to a recent version of pyth-agent.
    pub prev_publish_time: i64,
    pub ema_price:         i64,
    pub ema_conf:          u64,
}

#[cfg(feature = "quickcheck")]
impl Arbitrary for PriceFeedMessage {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        let mut id = [0u8; 32];
        for item in &mut id {
            *item = u8::arbitrary(g);
        }

        let publish_time = i64::arbitrary(g);

        PriceFeedMessage {
            id,
            price: i64::arbitrary(g),
            conf: u64::arbitrary(g),
            exponent: i32::arbitrary(g),
            publish_time,
            prev_publish_time: publish_time.saturating_sub(i64::arbitrary(g)),
            ema_price: i64::arbitrary(g),
            ema_conf: u64::arbitrary(g),
        }
    }
}

/// Message format for sending Twap data via the accumulator program
#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq, Serialize, Deserialize)]
pub struct TwapMessage {
    pub id:                [u8; 32],
    pub cumulative_price:  i128,
    pub cumulative_conf:   u128,
    pub num_down_slots:    u64,
    pub exponent:          i32,
    pub publish_time:      i64,
    pub prev_publish_time: i64,
    pub publish_slot:      u64,
}

#[cfg(feature = "quickcheck")]
impl Arbitrary for TwapMessage {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        let mut id = [0u8; 32];
        for item in &mut id {
            *item = u8::arbitrary(g);
        }

        let publish_time = i64::arbitrary(g);

        TwapMessage {
            id,
            cumulative_price: i128::arbitrary(g),
            cumulative_conf: u128::arbitrary(g),
            num_down_slots: u64::arbitrary(g),
            exponent: i32::arbitrary(g),
            publish_time,
            prev_publish_time: publish_time.saturating_sub(i64::arbitrary(g)),
            publish_slot: u64::arbitrary(g),
        }
    }
}
