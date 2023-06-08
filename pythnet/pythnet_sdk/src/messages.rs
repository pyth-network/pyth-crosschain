use {
    crate::wire::DeserializerError,
    byteorder::{
        BigEndian,
        ReadBytesExt,
    },
    std::io::{
        Cursor,
        Read,
    },
};


/// Message format for sending data to other chains via the accumulator program
/// When serialized, each message starts with a unique 1-byte discriminator, followed by the
/// serialized struct data in the definition(s) below.
///
/// Messages are forward-compatible. You may add new fields to messages after all previously
/// defined fields. All code for parsing messages must ignore any extraneous bytes at the end of
/// the message (which could be fields that the code does not yet understand).
///
/// The oracle is not using the Message enum due to the contract size limit and
/// some of the methods for PriceFeedMessage and TwapMessage are not used by the oracle
/// for the same reason. Rust compiler doesn't include the unused methods in the contract.
/// Once we start using the unused structs and methods, the contract size will increase.

#[derive(Debug, Copy, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
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
        strum::ToString,
    )),
    cfg_attr(
        feature = "serde",
        strum_discriminants(derive(serde::Serialize, serde::Deserialize))
    )
)]
pub enum Message {
    PriceFeedMessage(PriceFeedMessage),
    TwapMessage(TwapMessage),
}

#[allow(dead_code)]
impl Message {
    pub fn try_from_bytes(bytes: &[u8]) -> Result<Self, DeserializerError> {
        match bytes[0] {
            PriceFeedMessage::DISCRIMINATOR => Ok(Self::PriceFeedMessage(
                PriceFeedMessage::try_from_bytes(bytes)?,
            )),
            TwapMessage::DISCRIMINATOR => {
                Ok(Self::TwapMessage(TwapMessage::try_from_bytes(bytes)?))
            }
            _ => Err(DeserializerError::Message(
                "Invalid message discriminator".into(),
            )),
        }
    }

    pub fn to_bytes(self) -> Vec<u8> {
        match self {
            Self::PriceFeedMessage(msg) => msg.to_bytes().to_vec(),
            Self::TwapMessage(msg) => msg.to_bytes().to_vec(),
        }
    }

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


#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
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

#[allow(dead_code)]
impl PriceFeedMessage {
    // The size of the serialized message. Note that this is not the same as the size of the struct
    // (because of the discriminator & struct padding/alignment).
    pub const MESSAGE_SIZE: usize = 1 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
    pub const DISCRIMINATOR: u8 = 0;

    /// Serialize this message as an array of bytes (including the discriminator)
    /// Note that it would be more idiomatic to return a `Vec`, but that approach adds
    /// to the size of the compiled binary (which is already close to the size limit).
    #[allow(unused_assignments)]
    pub fn to_bytes(self) -> [u8; Self::MESSAGE_SIZE] {
        let mut bytes = [0u8; Self::MESSAGE_SIZE];

        let mut i: usize = 0;

        bytes[i..i + 1].clone_from_slice(&[Self::DISCRIMINATOR]);
        i += 1;

        bytes[i..i + 32].clone_from_slice(&self.id[..]);
        i += 32;

        bytes[i..i + 8].clone_from_slice(&self.price.to_be_bytes());
        i += 8;

        bytes[i..i + 8].clone_from_slice(&self.conf.to_be_bytes());
        i += 8;

        bytes[i..i + 4].clone_from_slice(&self.exponent.to_be_bytes());
        i += 4;

        bytes[i..i + 8].clone_from_slice(&self.publish_time.to_be_bytes());
        i += 8;

        bytes[i..i + 8].clone_from_slice(&self.prev_publish_time.to_be_bytes());
        i += 8;

        bytes[i..i + 8].clone_from_slice(&self.ema_price.to_be_bytes());
        i += 8;

        bytes[i..i + 8].clone_from_slice(&self.ema_conf.to_be_bytes());
        i += 8;

        bytes
    }

    /// Try to deserialize a message from an array of bytes (including the discriminator).
    /// This method is forward-compatible and allows the size to be larger than the
    /// size of the struct. As a side-effect, it will ignore newer fields that are
    /// not yet present in the struct.
    pub fn try_from_bytes(bytes: &[u8]) -> Result<Self, DeserializerError> {
        let mut cursor = Cursor::new(bytes);

        let discriminator = cursor
            .read_u8()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        if discriminator != 0 {
            return Err(DeserializerError::Message("Invalid discriminator".into()));
        }

        let mut id = [0u8; 32];
        cursor
            .read_exact(&mut id)
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;

        let price = cursor
            .read_i64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let conf = cursor
            .read_u64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let exponent = cursor
            .read_i32::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let publish_time = cursor
            .read_i64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let prev_publish_time = cursor
            .read_i64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let ema_price = cursor
            .read_i64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let ema_conf = cursor
            .read_u64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;

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

/// Message format for sending Twap data via the accumulator program
#[repr(C)]
#[derive(Debug, Copy, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
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

    /// Serialize this message as an array of bytes (including the discriminator)
    /// Note that it would be more idiomatic to return a `Vec`, but that approach adds
    /// to the size of the compiled binary (which is already close to the size limit).
    #[allow(unused_assignments)]
    pub fn to_bytes(self) -> [u8; Self::MESSAGE_SIZE] {
        let mut bytes = [0u8; Self::MESSAGE_SIZE];

        let mut i: usize = 0;

        bytes[i..i + 1].clone_from_slice(&[Self::DISCRIMINATOR]);
        i += 1;

        bytes[i..i + 32].clone_from_slice(&self.id[..]);
        i += 32;

        bytes[i..i + 16].clone_from_slice(&self.cumulative_price.to_be_bytes());
        i += 16;

        bytes[i..i + 16].clone_from_slice(&self.cumulative_conf.to_be_bytes());
        i += 16;

        bytes[i..i + 8].clone_from_slice(&self.num_down_slots.to_be_bytes());
        i += 8;

        bytes[i..i + 4].clone_from_slice(&self.exponent.to_be_bytes());
        i += 4;

        bytes[i..i + 8].clone_from_slice(&self.publish_time.to_be_bytes());
        i += 8;

        bytes[i..i + 8].clone_from_slice(&self.prev_publish_time.to_be_bytes());
        i += 8;

        bytes[i..i + 8].clone_from_slice(&self.publish_slot.to_be_bytes());
        i += 8;

        bytes
    }

    /// Try to deserialize a message from an array of bytes (including the discriminator).
    /// This method is forward-compatible and allows the size to be larger than the
    /// size of the struct. As a side-effect, it will ignore newer fields that are
    /// not yet present in the struct.
    pub fn try_from_bytes(bytes: &[u8]) -> Result<Self, DeserializerError> {
        let mut cursor = Cursor::new(bytes);

        let discriminator = cursor
            .read_u8()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        if discriminator != 1 {
            return Err(DeserializerError::Message("Invalid discriminator".into()));
        }

        let mut id = [0u8; 32];
        cursor
            .read_exact(&mut id)
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;

        let cumulative_price = cursor
            .read_i128::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let cumulative_conf = cursor
            .read_u128::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let num_down_slots = cursor
            .read_u64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let exponent = cursor
            .read_i32::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let publish_time = cursor
            .read_i64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let prev_publish_time = cursor
            .read_i64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;
        let publish_slot = cursor
            .read_u64::<BigEndian>()
            .map_err(|e| DeserializerError::Message(e.to_string().into()))?;

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
