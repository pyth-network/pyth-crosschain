#[cfg(feature = "solana-program")]
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
#[cfg(not(feature = "solana-program"))]
use borsh::{BorshDeserialize, BorshSerialize};
#[cfg(feature = "quickcheck")]
use quickcheck::Arbitrary;
use {
    crate::wire::PrefixedVec,
    borsh::BorshSchema,
    serde::{Deserialize, Serialize},
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
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
    PublisherStakeCapsMessage(PublisherStakeCapsMessage),
}

/// PublisherStakeCapsMessage is a global message that aggregates data from all price feeds
/// we can't associate it with a specific feed, so we use a feed id that is not used by any price feed
pub const PUBLISHER_STAKE_CAPS_MESSAGE_FEED_ID: FeedId = [1u8; 32];

impl Message {
    pub fn publish_time(&self) -> i64 {
        match self {
            Self::PriceFeedMessage(msg) => msg.publish_time,
            Self::TwapMessage(msg) => msg.publish_time,
            Self::PublisherStakeCapsMessage(msg) => msg.publish_time,
        }
    }

    /// TO DO : This API doesn't work with PublisherStakeCapsMessage since it doesn't have a feed_id, consider refactoring
    pub fn feed_id(&self) -> FeedId {
        match self {
            Self::PriceFeedMessage(msg) => msg.feed_id,
            Self::TwapMessage(msg) => msg.feed_id,
            Self::PublisherStakeCapsMessage(_) => PUBLISHER_STAKE_CAPS_MESSAGE_FEED_ID,
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

/// Id of a feed producing the message. One feed produces one or more messages.
pub type FeedId = [u8; 32];
pub type Pubkey = [u8; 32];

#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq, Serialize, Deserialize, BorshSchema)]
#[cfg_attr(feature = "solana-program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(
    not(feature = "solana-program"),
    derive(BorshSerialize, BorshDeserialize)
)]

pub struct PriceFeedMessage {
    /// `FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature.
    pub feed_id: [u8; 32],
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    /// The timestamp of this price update in seconds
    pub publish_time: i64,
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
    pub ema_price: i64,
    pub ema_conf: u64,
}

#[cfg(feature = "quickcheck")]
impl Arbitrary for PriceFeedMessage {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        let mut feed_id = [0u8; 32];
        for item in &mut feed_id {
            *item = u8::arbitrary(g);
        }

        let publish_time = i64::arbitrary(g);

        PriceFeedMessage {
            feed_id,
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

/// Message format for sending cumulative price data via the accumulator program.
/// These messages are used to calculate TWAPs for a given time window.
/// The calculated TWAPs are stored as TwapPrices in TwapUpdate accounts.
#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq, Serialize, Deserialize)]
pub struct TwapMessage {
    pub feed_id: FeedId,
    pub cumulative_price: i128,
    pub cumulative_conf: u128,
    pub num_down_slots: u64,
    pub exponent: i32,
    pub publish_time: i64,
    pub prev_publish_time: i64,
    pub publish_slot: u64,
}

#[cfg(feature = "quickcheck")]
impl Arbitrary for TwapMessage {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        let mut feed_id = [0u8; 32];
        for item in &mut feed_id {
            *item = u8::arbitrary(g);
        }

        let publish_time = i64::arbitrary(g);

        TwapMessage {
            feed_id,
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

#[repr(C)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PublisherStakeCapsMessage {
    pub publish_time: i64,
    pub caps: PrefixedVec<u16, PublisherStakeCap>, // PrefixedVec because we might have more than 256 publishers
}

#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq, Serialize, Deserialize)]
pub struct PublisherStakeCap {
    pub publisher: Pubkey,
    pub cap: u64,
}

#[cfg(feature = "quickcheck")]
impl Arbitrary for PublisherStakeCapsMessage {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        let caps = Vec::arbitrary(g);
        PublisherStakeCapsMessage {
            publish_time: i64::arbitrary(g),
            caps: caps.into(),
        }
    }
}

#[cfg(feature = "quickcheck")]
impl Arbitrary for PublisherStakeCap {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        PublisherStakeCap {
            publisher: {
                let mut publisher = [0u8; 32];
                for item in &mut publisher {
                    *item = u8::arbitrary(g);
                }
                publisher
            },
            cap: u64::arbitrary(g),
        }
    }
}

#[cfg(test)]
mod tests {

    use crate::{
        messages::{Message, PriceFeedMessage},
        wire::Serializer,
    };

    // Test if additional payload to the end of a message is forward compatible
    #[test]
    fn test_forward_compatibility() {
        use {serde::Serialize, std::iter};
        let msg = Message::PriceFeedMessage(PriceFeedMessage {
            feed_id: [1u8; 32],
            price: 1,
            conf: 1,
            exponent: 1,
            publish_time: 1,
            prev_publish_time: 1,
            ema_price: 1,
            ema_conf: 1,
        });
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        let mut serializer: Serializer<_, byteorder::LE> = Serializer::new(&mut cursor);
        msg.serialize(&mut serializer).unwrap();
        buffer.extend(iter::repeat(0).take(10));
        let deserialized = crate::wire::from_slice::<byteorder::LE, Message>(&buffer).unwrap();
        assert_eq!(deserialized, msg);
    }
}
