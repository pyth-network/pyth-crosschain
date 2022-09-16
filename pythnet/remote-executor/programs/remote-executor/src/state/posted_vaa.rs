use std::{io::Write, str::FromStr};
use anchor_lang::prelude::*;

// TO DO : Update this file to use wormhole solana once the sdk is fixed
impl Owner for PostedVaa {
    fn owner() -> Pubkey{
        Pubkey::from_str("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o").unwrap() // Placeholder bridge address
    }
}

pub const CHAIN_ID_SOLANA : u16 = 1;

impl AccountDeserialize for PostedVaa {
    // Manual implementation because this account does not have an anchor discriminator
    fn try_deserialize(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
        Self::try_deserialize_unchecked(buf)
    }

    // Manual implementation because this account does not have an anchor discriminator
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {   
        AnchorDeserialize::deserialize(buf)
        .map_err(|_| anchor_lang::error::ErrorCode::AccountDidNotDeserialize.into())
    }
}

impl AccountSerialize for PostedVaa {
    // Make this fail, this is readonly VAA it should never be serialized by this program
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        return Err(anchor_lang::error::ErrorCode::AccountDidNotSerialize.into());
    }
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct PostedVaa {
    /// Header of the posted VAA
    pub vaa_version: u8,

    /// Level of consistency requested by the emitter
    pub consistency_level: u8,

    /// Time the vaa was submitted
    pub vaa_time: u32,

    /// Account where signatures are stored
    pub vaa_signature_account: Pubkey,

    /// Time the posted message was created
    pub submission_time: u32,

    /// Unique nonce for this message
    pub nonce: u32,

    /// Sequence number of this message
    pub sequence: u64,

    /// Emitter of the message
    pub emitter_chain: u16,

    /// Emitter of the message
    pub emitter_address: [u8; 32],

    /// Message payload
    pub payload: Vec<u8>,
}
