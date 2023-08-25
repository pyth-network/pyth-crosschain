use {
    super::proof::wormhole_merkle::WormholeMerkleMessageProof,
    crate::network::p2p::Vaa,
    borsh::BorshDeserialize,
    pyth_sdk::PriceFeed,
};

#[derive(Clone, PartialEq, Debug)]
pub struct ProofSet {
    pub wormhole_merkle_proof: WormholeMerkleMessageProof,
}

pub type Slot = u64;

/// The number of seconds since the Unix epoch (00:00:00 UTC on 1 Jan 1970). The timestamp is
/// always positive, but represented as a signed integer because that's the standard on Unix
/// systems and allows easy subtraction to compute durations.
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

#[derive(Debug)]
pub enum Update {
    Vaa(Vaa),
    AccumulatorMessages(AccumulatorMessages),
}

#[derive(Debug, PartialEq)]
pub struct PriceFeedUpdate {
    pub price_feed:  PriceFeed,
    pub slot:        Option<Slot>,
    pub received_at: Option<UnixTimestamp>,
    pub update_data: Option<Vec<u8>>,
}

#[derive(Debug, PartialEq)]
pub struct PriceFeedsWithUpdateData {
    pub price_feeds: Vec<PriceFeedUpdate>,
    pub update_data: Vec<Vec<u8>>,
}
