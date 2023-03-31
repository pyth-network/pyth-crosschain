pub mod error;
pub mod state;

#[cfg(test)]
mod tests;

use {
    wormhole::Chain::{
        self,
        Solana,
        Pythnet,
    },
    state::AnchorVaa,
    anchor_lang::prelude::*,
    pyth_wormhole_attester_sdk::BatchPriceAttestation,
    solana_program::{ keccak, secp256k1_recover::secp256k1_recover },
};
use wormhole_solana::instructions::PostVAAData;

use crate::error::ReceiverError::*;

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    pub const PROGRAM_ID: &str = "pythKkWXoywbvTQVcWrNDz5ENvWteF7tem7xzW52NBK";
    declare_id!("pythKkWXoywbvTQVcWrNDz5ENvWteF7tem7xzW52NBK");

    pub fn decode_posted_vaa(ctx: Context<DecodePostedVaa>) -> Result<()> {
        let posted_vaa = &ctx.accounts.posted_vaa.payload;
        let batch: BatchPriceAttestation =
            BatchPriceAttestation::deserialize(posted_vaa.as_slice())
            .map_err(|_| DeserializeVAAFailed)?;

        msg!("There are {} attestations in this batch.", batch.price_attestations.len());

        for attestation in batch.price_attestations {
            msg!("product_id: {}", attestation.product_id);
            msg!("price_id: {}", attestation.price_id);
            msg!("price: {}", attestation.price);
            msg!("conf: {}", attestation.conf);
            msg!("ema_price: {}", attestation.ema_price);
            msg!("ema_conf: {}", attestation.ema_conf);
            msg!("num_publishers: {}", attestation.num_publishers);
            msg!("publish_time: {}", attestation.publish_time);
            msg!("attestation_time: {}", attestation.attestation_time);
        }

        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, data: Vec<u8>) -> Result<()> {
        // FIXME: more security checks
        // ctx.accounts.guardian_set.index == vaa_data.index;

        /*
        let message_hash = {
            let mut hasher = keccak::Hasher::default();
            hasher.hash(&instruction.message);
            hasher.result()
        };

        let recovered_pubkey = secp256k1_recover(
            &message_hash.0,
            instruction.recovery_id,
            &instruction.signature,
        ).map_err(|_| ProgramError::InvalidArgument)?;
*/

            //
            //     // If we're using this function for signature verification then we
            //     // need to check the pubkey is an expected value.
            //     // Here we are checking the secp256k1 pubkey against a known authorized pubkey.
            //     if recovered_pubkey.0 != AUTHORIZED_PUBLIC_KEY {
            //         return Err(ProgramError::InvalidArgument);
            //     }


        // ctx.accounts.guardian_set.keys[0].
        Ok(())
    }
}

#[derive(Accounts)]
pub struct DecodePostedVaa<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(constraint = (Chain::from(posted_vaa.emitter_chain) == Solana || Chain::from(posted_vaa.emitter_chain) == Pythnet) @ EmitterChainNotSolanaOrPythnet, constraint = (&posted_vaa.magic == b"vaa" || &posted_vaa.magic == b"msg" || &posted_vaa.magic == b"msu") @PostedVaaHeaderWrongMagicNumber)]
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

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
}
