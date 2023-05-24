use {
    super::proof::wormhole_merkle::{
        WormholeMerkleMessageProof,
        WormholeMerkleProof,
    },
    anyhow::{
        anyhow,
        Result,
    },
    borsh::BorshDeserialize,
};

#[derive(Clone, Debug, PartialEq)]
pub enum WormholePayload {
    Merkle(WormholeMerkleProof),
}

impl WormholePayload {
    pub fn try_from_bytes(bytes: &[u8], vaa_bytes: &[u8]) -> Result<Self> {
        if bytes.len() != 37 {
            return Err(anyhow!("Invalid message length"));
        }

        // TODO: Use byte string literals for this check
        let magic = u32::from_be_bytes(bytes[0..4].try_into()?);
        if magic != 0x41555756u32 {
            return Err(anyhow!("Invalid magic"));
        }

        let message_type = u8::from_be_bytes(bytes[4..5].try_into()?);

        if message_type != 0 {
            return Err(anyhow!("Invalid message type"));
        }

        let slot = u64::from_be_bytes(bytes[5..13].try_into()?);
        let ring_size = u32::from_be_bytes(bytes[13..17].try_into()?);
        let root_digest = bytes[17..37].try_into()?;


        Ok(Self::Merkle(WormholeMerkleProof {
            root: root_digest,
            slot,
            ring_size,
            vaa: vaa_bytes.to_vec(),
        }))
    }
}

pub type RawMessage = Vec<u8>;
pub type MessageIdentifier = [u8; 32];

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub enum MessageType {
    PriceFeed,
    TwapPrice,
}

impl MessageType {
    pub fn all() -> Vec<Self> {
        // FIXME: This is a bit brittle, guard it in the future
        vec![Self::PriceFeed, Self::TwapPrice]
    }
}

#[derive(Clone, PartialEq, Debug)]
pub struct WormholeMerkleState {
    pub digest_proof: Vec<u8>,
    pub tree:         Option<Vec<Vec<u8>>>,
}

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub struct MessageKey {
    // -> this is the real message id
    pub id:    MessageIdentifier, // -> this is price feed id
    pub type_: MessageType,
}

#[derive(Clone, PartialEq, Eq, Debug, PartialOrd, Ord)]
pub struct MessageTime {
    pub publish_time: UnixTimestamp,
    pub slot:         Slot,
}

#[derive(Clone, PartialEq, Debug)]
pub struct ProofSet {
    pub wormhole_merkle_proof: WormholeMerkleMessageProof,
}


#[derive(Clone, PartialEq, Debug)]
pub struct MessageState {
    pub publish_time: UnixTimestamp,
    pub slot:         Slot,
    pub id:           MessageIdentifier,
    pub type_:        MessageType,
    pub message:      Message,
    pub raw_message:  RawMessage,
    pub proof_set:    ProofSet,
}

impl MessageState {
    pub fn time(&self) -> MessageTime {
        MessageTime {
            publish_time: self.publish_time,
            slot:         self.slot,
        }
    }

    pub fn key(&self) -> MessageKey {
        MessageKey {
            id:    self.id,
            type_: self.type_.clone(),
        }
    }

    pub fn new(message: Message, raw_message: RawMessage, proof_set: ProofSet, slot: Slot) -> Self {
        Self {
            publish_time: message.publish_time(),
            slot,
            id: *message.id(),
            type_: message.message_type(),
            message,
            raw_message,
            proof_set,
        }
    }
}

pub enum RequestType {
    All,
    Some(Vec<MessageType>),
}

impl From<RequestType> for Vec<MessageType> {
    fn from(request_type: RequestType) -> Self {
        match request_type {
            RequestType::All => MessageType::all(),
            RequestType::Some(types) => types,
        }
    }
}

pub type Slot = u64;
pub type UnixTimestamp = i64;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum RequestTime {
    Latest,
    FirstAfter(UnixTimestamp),
}

#[derive(Clone, PartialEq, Debug, BorshDeserialize)]
pub struct AccumulatorMessages {
    pub magic:     [u8; 4],
    pub slot:      Slot,
    pub ring_size: u32,
    pub messages:  Vec<RawMessage>,
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

#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq)]
pub struct PriceFeedMessage {
    pub id:                [u8; 32],
    pub price:             i64,
    pub conf:              u64,
    pub exponent:          i32,
    pub publish_time:      i64,
    pub prev_publish_time: i64,
    pub ema_price:         i64,
    pub ema_conf:          u64,
}

impl PriceFeedMessage {
    // The size of the serialized message. Note that this is not the same as the size of the struct
    // (because of the discriminator & struct padding/alignment).
    pub const MESSAGE_SIZE: usize = 1 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
    pub const DISCRIMINATOR: u8 = 0;

    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        if bytes.len() != Self::MESSAGE_SIZE {
            return Err(anyhow!("Invalid message length"));
        }

        let mut id = [0u8; 32];
        id.copy_from_slice(&bytes[1..33]);

        let price = i64::from_be_bytes(bytes[33..41].try_into()?);
        let conf = u64::from_be_bytes(bytes[41..49].try_into()?);
        let exponent = i32::from_be_bytes(bytes[49..53].try_into()?);
        let publish_time = i64::from_be_bytes(bytes[53..61].try_into()?);
        let prev_publish_time = i64::from_be_bytes(bytes[61..69].try_into()?);
        let ema_price = i64::from_be_bytes(bytes[69..77].try_into()?);
        let ema_conf = u64::from_be_bytes(bytes[77..85].try_into()?);

        Ok(Self {
            id,
            price,
            conf,
            exponent,
            publish_time,
            prev_publish_time,
            ema_price,
            ema_conf,
        })
    }
}

#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq)]
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

#[allow(dead_code)]
impl TwapMessage {
    // The size of the serialized message. Note that this is not the same as the size of the struct
    // (because of the discriminator & struct padding/alignment).
    pub const MESSAGE_SIZE: usize = 1 + 32 + 16 + 16 + 8 + 4 + 8 + 8 + 8;
    pub const DISCRIMINATOR: u8 = 1;

    // FIXME: Use nom or a TLV ser/de library
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        if bytes.len() != Self::MESSAGE_SIZE {
            return Err(anyhow!("Invalid message length"));
        }

        let mut id = [0u8; 32];
        id.copy_from_slice(&bytes[1..33]);

        let cumulative_price = i128::from_be_bytes(bytes[33..49].try_into()?);
        let cumulative_conf = u128::from_be_bytes(bytes[49..65].try_into()?);
        let num_down_slots = u64::from_be_bytes(bytes[65..73].try_into()?);
        let exponent = i32::from_be_bytes(bytes[73..77].try_into()?);
        let publish_time = i64::from_be_bytes(bytes[77..85].try_into()?);
        let prev_publish_time = i64::from_be_bytes(bytes[85..93].try_into()?);
        let publish_slot = u64::from_be_bytes(bytes[93..101].try_into()?);

        Ok(Self {
            id,
            cumulative_price,
            cumulative_conf,
            num_down_slots,
            exponent,
            publish_time,
            prev_publish_time,
            publish_slot,
        })
    }
}

#[derive(Clone, PartialEq, Debug)]
pub enum Message {
    PriceFeed(PriceFeedMessage),
    TwapPrice(TwapMessage),
}

impl Message {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        match bytes[0] {
            PriceFeedMessage::DISCRIMINATOR => {
                Ok(Self::PriceFeed(PriceFeedMessage::from_bytes(bytes)?))
            }
            TwapMessage::DISCRIMINATOR => Ok(Self::TwapPrice(TwapMessage::from_bytes(bytes)?)),
            _ => Err(anyhow!("Invalid message discriminator")),
        }
    }

    pub fn message_type(&self) -> MessageType {
        match self {
            Self::PriceFeed(_) => MessageType::PriceFeed,
            Self::TwapPrice(_) => MessageType::TwapPrice,
        }
    }

    pub fn id(&self) -> &[u8; 32] {
        match self {
            Self::PriceFeed(msg) => &msg.id,
            Self::TwapPrice(msg) => &msg.id,
        }
    }

    pub fn publish_time(&self) -> i64 {
        match self {
            Self::PriceFeed(msg) => msg.publish_time,
            Self::TwapPrice(msg) => msg.publish_time,
        }
    }
}

pub struct PriceFeedsWithUpdateData {
    pub price_feeds:                 Vec<PriceFeedMessage>,
    pub wormhole_merkle_update_data: Vec<Vec<u8>>,
}
