//! This module provides Wormhole primitives.
//!
//! Wormhole does not provide an SDK for working with Solana versions of Wormhole related types, so
//! we clone the definitions from the Solana contracts here and adapt them to Pyth purposes. This
//! allows us to emit and parse messages through Wormhole.
use {
    crate::Pubkey,
    borsh::{BorshDeserialize, BorshSerialize},
    serde::{Deserialize, Serialize},
    std::{
        io::{Error, ErrorKind::InvalidData, Write},
        ops::{Deref, DerefMut},
    },
};

#[repr(transparent)]
#[derive(Default, PartialEq, Debug)]
pub struct PostedMessageUnreliableData {
    pub message: MessageData,
}

#[derive(
    Debug, Default, BorshSerialize, BorshDeserialize, Clone, Serialize, Deserialize, PartialEq,
)]
pub struct MessageData {
    pub vaa_version: u8,
    pub consistency_level: u8,
    pub vaa_time: u32,
    pub vaa_signature_account: Pubkey,
    pub submission_time: u32,
    pub nonce: u32,
    pub sequence: u64,
    pub emitter_chain: u16,
    pub emitter_address: [u8; 32],
    pub payload: Vec<u8>,
}

impl BorshSerialize for PostedMessageUnreliableData {
    fn serialize<W: Write>(&self, writer: &mut W) -> std::io::Result<()> {
        writer.write_all(b"msu")?;
        BorshSerialize::serialize(&self.message, writer)
    }
}

impl BorshDeserialize for PostedMessageUnreliableData {
    fn deserialize_reader<R: std::io::prelude::Read>(reader: &mut R) -> std::io::Result<Self> {
        let mut magic = [0u8; 3];
        reader.read_exact(&mut magic)?;

        let expected = b"msu";
        if &magic != expected {
            return Err(Error::new(
                InvalidData,
                format!("Magic mismatch. Expected {expected:?} but got {magic:?}"),
            ));
        };
        Ok(PostedMessageUnreliableData {
            message: <MessageData as BorshDeserialize>::deserialize_reader(reader)?,
        })
    }
}

impl Deref for PostedMessageUnreliableData {
    type Target = MessageData;
    fn deref(&self) -> &Self::Target {
        &self.message
    }
}

impl DerefMut for PostedMessageUnreliableData {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.message
    }
}

impl Clone for PostedMessageUnreliableData {
    fn clone(&self) -> Self {
        PostedMessageUnreliableData {
            message: self.message.clone(),
        }
    }
}

#[derive(Default, Clone, Copy, BorshDeserialize, BorshSerialize)]
pub struct AccumulatorSequenceTracker {
    pub sequence: u64,
}

#[test]
fn test_borsh_roundtrip() {
    let post_message_unreliable_data = PostedMessageUnreliableData {
        message: MessageData {
            vaa_version: 1,
            consistency_level: 2,
            vaa_time: 3,
            vaa_signature_account: [4u8; 32],
            submission_time: 5,
            nonce: 6,
            sequence: 7,
            emitter_chain: 8,
            emitter_address: [9u8; 32],
            payload: vec![10u8; 32],
        },
    };

    let encoded = borsh::to_vec(&post_message_unreliable_data).unwrap();

    let decoded = PostedMessageUnreliableData::try_from_slice(encoded.as_slice()).unwrap();
    assert_eq!(decoded, post_message_unreliable_data);
}
