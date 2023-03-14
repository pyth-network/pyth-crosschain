use {
    std::{
        io::Write,
        ops::Deref,
        str::FromStr,
    },
    wormhole_solana::VAA,
    anchor_lang::prelude::*,
};

// The current chain's wormhole bridge owns the VAA accounts
impl Owner for AnchorVaa {
    fn owner() -> Pubkey {
        // wormhole address on solana devnet
        Pubkey::from_str("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5").unwrap()
    }
}

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
        Err(anchor_lang::error::ErrorCode::AccountDidNotSerialize.into())
    }
}

impl Deref for AnchorVaa {
    type Target = VAA;

    fn deref(&self) -> &Self::Target {
        &self.vaa
    }
}

#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct AnchorVaa {
    pub magic: [u8; 3],
    pub vaa:   VAA,
}
