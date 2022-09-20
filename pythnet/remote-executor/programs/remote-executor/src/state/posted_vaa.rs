use std::{io::Write, str::FromStr, ops::Deref};
use anchor_lang::prelude::*;
use wormhole_solana::VAA;

// TO DO : Update this file to use wormhole solana once the sdk is fixed
impl Owner for AnchorVaa {
    fn owner() -> Pubkey{
        Pubkey::from_str("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o").unwrap() // Placeholder bridge address
    }
}

pub const CHAIN_ID_SOLANA : u16 = 1;

impl AccountDeserialize for AnchorVaa {
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

impl AccountSerialize for AnchorVaa {
    // Make this fail, this is readonly VAA it should never be serialized by this program
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        return Err(anchor_lang::error::ErrorCode::AccountDidNotSerialize.into());
    }
}

impl Deref for AnchorVaa {
    type Target = VAA;

    fn deref(&self) -> &Self::Target {
        &self.vaa
    }
}


#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct AnchorVaa{
    pub vaa : VAA
}
