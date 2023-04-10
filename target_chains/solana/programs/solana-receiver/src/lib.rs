pub mod error;
pub mod state;

#[cfg(test)]
mod tests;

use {
    crate::error::ReceiverError::*,
    anchor_lang::prelude::*,
    hex::ToHex,
    pyth_wormhole_attester_sdk::BatchPriceAttestation,
    solana_program::{
        keccak,
        secp256k1_recover::secp256k1_recover,
    },
    state::AnchorVaa,
    wormhole::Chain::{
        self,
        Pythnet,
        Solana,
    },
};

declare_id!("pythKkWXoywbvTQVcWrNDz5ENvWteF7tem7xzW52NBK");

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    pub fn decode_posted_vaa(ctx: Context<DecodePostedVaa>) -> Result<()> {
        let posted_vaa = &ctx.accounts.posted_vaa.payload;
        let batch: BatchPriceAttestation =
            BatchPriceAttestation::deserialize(posted_vaa.as_slice())
                .map_err(|_| DeserializeVAAFailed)?;

        msg!(
            "There are {} attestations in this batch.",
            batch.price_attestations.len()
        );

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

    pub fn update(
        _ctx: Context<Update>,
        data: Vec<u8>,
        recovery_id: u8,
        signature: [u8; 64],
    ) -> Result<()> {
        // This costs about 10k compute units
        let message_hash = {
            let mut hasher = keccak::Hasher::default();
            hasher.hash(&data);
            hasher.result()
        };

        // This costs about 25k compute units
        let recovered_pubkey = secp256k1_recover(&message_hash.0, recovery_id, &signature)
            .map_err(|_| ProgramError::InvalidArgument)?;

        msg!(
            "Recovered key: {}",
            recovered_pubkey.0.encode_hex::<String>()
        );

        // TODO: Check the pubkey is an expected value.
        // Here we are checking the secp256k1 pubkey against a known authorized pubkey.
        //
        // if recovered_pubkey.0 != AUTHORIZED_PUBLIC_KEY {
        //  return Err(ProgramError::InvalidArgument);
        // }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct DecodePostedVaa<'info> {
    #[account(mut)]
    pub payer:      Signer<'info>,
    #[account(constraint = (Chain::from(posted_vaa.emitter_chain) == Solana || Chain::from(posted_vaa.emitter_chain) == Pythnet) @ EmitterChainNotSolanaOrPythnet, constraint = (&posted_vaa.magic == b"vaa" || &posted_vaa.magic == b"msg" || &posted_vaa.magic == b"msu") @PostedVaaHeaderWrongMagicNumber)]
    pub posted_vaa: Account<'info, AnchorVaa>,
}

impl crate::accounts::DecodePostedVaa {
    pub fn populate(payer: &Pubkey, posted_vaa: &Pubkey) -> Self {
        crate::accounts::DecodePostedVaa {
            payer:      *payer,
            posted_vaa: *posted_vaa,
        }
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}
