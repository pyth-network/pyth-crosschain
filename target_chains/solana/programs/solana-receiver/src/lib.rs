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
use crate::error::ReceiverError::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    pub fn decode_posted_vaa(ctx: Context<DecodePostedVaa>) -> Result<()> {
        let posted_vaa = &ctx.accounts.posted_vaa.payload;
        let attestation = PriceAttestation::deserialize(posted_vaa.as_slice())
            .map_err(|_| DeserializeVAAFailed)?;

        msg!("product_id: {}", attestation.product_id);
        msg!("price_id: {}", attestation.price_id);
        msg!("price: {}", attestation.price);
        msg!("conf: {}", attestation.conf);
        msg!("ema_price: {}", attestation.ema_price);
        msg!("ema_conf: {}", attestation.ema_conf);
        msg!("num_publishers: {}", attestation.num_publishers);
        msg!("publish_time: {}", attestation.publish_time);
        msg!("attestation_time: {}", attestation.attestation_time);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct DecodePostedVaa<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(constraint = Chain::from(posted_vaa.emitter_chain) == Solana @ EmitterChainNotSolana)]
    pub posted_vaa:     Account<'info, AnchorVaa>,
}

impl crate::accounts::DecodePostedVaa {
    pub fn populate(
        payer: &Pubkey,
        posted_vaa: &Pubkey,
    ) -> Self {
        crate::accounts::DecodePostedVaa {
            payer: *payer,
            posted_vaa: *posted_vaa,
        }
    }
}
