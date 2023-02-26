pub mod error;
pub mod state;

use {
    wormhole::Chain::{
        self,
        Solana,
    },
    state::AnchorVaa,
    anchor_lang::prelude::*,
    pyth_wormhole_attester_sdk::PriceAttestation,
};

use crate::error::ReceiverError::*;

declare_id!("H5gewNsx3yQbGeLZaRbzxn3CUNZz4EVSUNgs9Q1vaeWY");

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

#[cfg(test)]
mod tests {
    use pyth_sdk::Identifier;
    use pyth_wormhole_attester_sdk::PriceStatus;
    use pyth_wormhole_attester_sdk::PriceAttestation;

    #[test]
    fn mock_attestation() {
        let _attestation = PriceAttestation {
            product_id:                 Identifier::new([18u8; 32]),
            price_id:                   Identifier::new([150u8; 32]),
            price:                      0x2bad2feed7,
            conf:                       101,
            ema_price:                  -42,
            ema_conf:                   42,
            expo:                       -3,
            status:                     PriceStatus::Trading,
            num_publishers:             123212u32,
            max_num_publishers:         321232u32,
            attestation_time:           (0xdeadbeeffadeu64) as i64,
            publish_time:               0xdadebeefi64,
            prev_publish_time:          0xdeadbabei64,
            prev_price:                 0xdeadfacebeefi64,
            prev_conf:                  0xbadbadbeefu64,
            last_attested_publish_time: (0xdeadbeeffadedeafu64) as i64,
        };

        // TODO: create a VAA with this attestation as payload
        // and then invoke DecodePostedVaa
    }
}
