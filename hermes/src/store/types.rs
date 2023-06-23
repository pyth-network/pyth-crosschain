use {
    super::proof::wormhole_merkle::WormholeMerkleMessageProof,
    borsh::BorshDeserialize,
    pythnet_sdk::messages::PriceFeedMessage,
};

#[derive(Clone, PartialEq, Debug)]
pub struct ProofSet {
    pub wormhole_merkle_proof: WormholeMerkleMessageProof,
}

pub type Slot = u64;
pub type UnixTimestamp = i64;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum RequestTime {
    Latest,
    FirstAfter(UnixTimestamp),
}

pub type RawMessage = Vec<u8>;

/// Accumulator messages coming from Pythnet validators.
///
/// The validators writes the accumulator messages using Borsh with
/// the following struct. We cannot directly have messages as Vec<Messages>
/// because they are serialized using big-endian byte order and Borsh
/// uses little-endian byte order.
#[derive(Clone, PartialEq, Debug, BorshDeserialize)]
pub struct AccumulatorMessages {
    pub magic:        [u8; 4],
    pub slot:         u64,
    pub ring_size:    u32,
    pub raw_messages: Vec<RawMessage>,
}

impl AccumulatorMessages {
    pub fn ring_index(&self) -> u32 {
        (self.slot % self.ring_size as u64) as u32
    }
}

pub enum Update {
    Vaa(Vec<u8>),
    AccumulatorMessages(AccumulatorMessages),
}

pub struct PriceFeedUpdate {
    pub price_feed:                  PriceFeedMessage,
    pub slot:                        Slot,
    pub received_at:                 UnixTimestamp,
    /// Wormhole merkle update data for this single price feed update.
    /// This field is available for backward compatibility and will be
    /// removed in the future.
    pub wormhole_merkle_update_data: Vec<u8>,
}

pub struct PriceFeedsWithUpdateData {
    pub price_feeds:                 Vec<PriceFeedUpdate>,
    pub wormhole_merkle_update_data: Vec<Vec<u8>>,
}
