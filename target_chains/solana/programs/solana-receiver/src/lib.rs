pub mod error;
pub mod state;

use {
    anchor_lang::prelude::*,
    state::AnchorVaa,
    wormhole::Chain::{
        self,
        Solana,
    },
    pyth_wormhole_attester_sdk::PriceAttestation,
};
use crate::error::ReceiverError;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[derive(Accounts)]
pub struct DecodePostedVaa<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(constraint = Chain::from(posted_vaa.emitter_chain) == Solana @ ErrorCode::EmitterChainNotSolana,
              constraint = (&posted_vaa.magic == b"vaa" || &posted_vaa.magic == b"msg" || &posted_vaa.magic == b"msu") @ErrorCode::PostedVaaHeaderWrongMagicNumber )]
    pub posted_vaa:     Account<'info, AnchorVaa>,
}

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    pub fn decode_posted_vaa(ctx: Context<DecodePostedVaa>) -> Result<()> {
        let posted_vaa = &ctx.accounts.posted_vaa.payload;
        let attestation = PriceAttestation::deserialize(posted_vaa.as_slice())
            .map_err(|_| ReceiverError::DeserializeVAAFailed)?;

        msg!("product_id: {}", attestation.product_id);
        msg!("price_id: {}", attestation.price_id);
        msg!("price: {}", attestation.price);
        msg!("conf: {}", attestation.conf);

        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("The emitter of the VAA is not Solana.")]
    EmitterChainNotSolana,
    #[msg("Posted VAA has wrong magic number in header.")]
    PostedVaaHeaderWrongMagicNumber,
}
