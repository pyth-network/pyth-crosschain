use {
    anchor_lang::prelude::*,
    std::{io::Write, ops::Deref, str::FromStr},
    wormhole_solana::VAA,
};

// The current chain's wormhole bridge owns the VAA accounts
impl Owner for AnchorVaa {
    #[cfg(feature = "pythnet")]
    fn owner() -> Pubkey {
        Pubkey::from_str("H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU").unwrap()
    }

    #[cfg(feature = "pythtest")]
    fn owner() -> Pubkey {
        Pubkey::from_str("EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z").unwrap()
    }

    #[cfg(any(
        feature = "eclipse_devnet",
        feature = "eclipse_testnet",
        feature = "eclipse_mainnet",
        feature = "mantis_testnet",
        feature = "sonic_devnet",
        feature = "sonic_testnet",
        feature = "atlas_testnet",
        feature = "mantis_mainnet",
        feature = "sonic_mainnet",
    ))]
    fn owner() -> Pubkey {
        Pubkey::from_str("HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ").unwrap()
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
    pub vaa: VAA,
}
