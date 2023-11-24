use {
    crate::error::ReceiverError,
    anchor_lang::prelude::*,
    std::{
        io::Write,
        ops::Deref,
    },
    wormhole_anchor_sdk::wormhole::PostedVaaData,
};

// The current chain's wormhole bridge owns the VAA accounts
impl Owner for AnchorVaa {
    fn owner() -> Pubkey {
        PostedVaaData::owner()
    }
}

impl AccountDeserialize for AnchorVaa {
    // Manual implementation because this account does not have an anchor discriminator
    fn try_deserialize(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
        require!(buf.len() >= 3, ErrorCode::AccountDiscriminatorNotFound);
        let given_disc = &buf[..3];
        require!(
            *given_disc == *b"vaa",
            ReceiverError::PostedVaaHeaderWrongMagicNumber
        );
        Self::try_deserialize_unchecked(&mut &buf[3..])
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
        Err(anchor_lang::error::ErrorCode::AccountDidNotSerialize.into())
    }
}

impl Deref for AnchorVaa {
    type Target = PostedVaaData;

    fn deref(&self) -> &Self::Target {
        &self.vaa
    }
}

#[derive(Clone, PartialEq, AnchorDeserialize, AnchorSerialize)]
pub struct AnchorVaa {
    pub vaa: PostedVaaData,
}
