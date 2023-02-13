use {
    anchor_lang::prelude::*,
    state::AnchorVaa,
    wormhole::Chain::{
        self,
        Solana,
    },
    pyth_wormhole_attester_sdk::PriceAttestation,
};
pub mod state;

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
        let posted_vaa = &ctx.accounts.posted_vaa;
        //let payload = ExecutorPayload::try_from_slice(&posted_vaa.payload)?;
        let payload = PriceAttestation::deserialize(&posted_vaa.payload)?;

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
