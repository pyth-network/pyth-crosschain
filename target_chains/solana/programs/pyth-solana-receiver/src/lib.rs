pub mod error;
pub mod state;

use {
    crate::error::ReceiverError,
    anchor_lang::prelude::*,
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot,
        hashers::keccak256_160::Keccak160,
        messages::Message,
        wire::{
            from_slice,
            v1::{
                MerklePriceUpdate,
                WormholeMessage,
                WormholePayload,
            },
        },
    },
    serde::Deserialize,
    sha3::Digest,
    state::AnchorVaa,
    std::io::Write,
    wormhole_anchor_sdk::wormhole::SEED_PREFIX_POSTED_VAA,
};

declare_id!("DvPfMBZJJwKgJsv2WJA8bFwUMn8nFd5Xpioc6foC3rse");
pub const POST_VAA: u8 = 2;

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    /// Verify the updates using the posted_vaa account
    ///  * `vaa_hash` hash post of the post_vaa data to derive the address of the post_vaa account
    ///  * `emitter_chain` expected emitter_chain from the post_vaa account
    ///  * `price_updates` Vec of bytes for the updates to verify and post on-chain
    ///
    /// TODO:
    ///    - use a `config` account that can only be modified by governance for checking emitter_chain
    ///      and other constraints
    ///

    #[allow(unused_variables)]
    pub fn post_updates(
        ctx: Context<PostUpdates>,
        vaa_hash: [u8; 32], // used for pda seeds
        emitter_chain: u16,
        price_updates: Vec<Vec<u8>>,
    ) -> Result<()> {
        let vaa = &ctx.accounts.posted_vaa;
        require_eq!(
            vaa.emitter_chain(),
            emitter_chain,
            ReceiverError::InvalidEmitterChain
        );
        let wh_message = WormholeMessage::try_from_bytes(vaa.payload.as_slice())
            .map_err(|_| ReceiverError::InvalidWormholeMessage)?;
        msg!("constructed wh_message {:?}", wh_message);
        let root: MerkleRoot<Keccak160> = MerkleRoot::new(match wh_message.payload {
            WormholePayload::Merkle(merkle_root) => merkle_root.root,
        });

        let mut count_updates = 0;

        let price_updates_len = price_updates.len();
        for price_update in price_updates {
            let merkle_price_update =
                from_slice::<byteorder::BE, MerklePriceUpdate>(price_update.as_slice())
                    .map_err(|_| ReceiverError::DeserializeUpdateFailed)?;
            let message_vec = Vec::from(merkle_price_update.message);
            if !root.check(merkle_price_update.proof, &message_vec) {
                return err!(ReceiverError::InvalidPriceUpdate);
            }
            let msg = from_slice::<byteorder::BE, Message>(&message_vec)
                .map_err(|_| ReceiverError::InvalidAccumulatorMessage)?;

            match msg {
                Message::PriceFeedMessage(price_feed_message) => {
                    count_updates += 1;
                    msg!("price_feed_message: {:?}", price_feed_message);
                }
                Message::TwapMessage(twap_message) => {
                    count_updates += 1;
                    msg!("twap_message: {:?}", twap_message);
                }
                _ => return err!(ReceiverError::InvalidAccumulatorMessageType),
            }
        }
        msg!("verified {} / {} updates", count_updates, price_updates_len);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32], emitter_chain: u16)]
pub struct PostUpdates<'info> {
    #[account(mut)]
    pub payer:            Signer<'info>,
    #[account(
        seeds = [
            SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        seeds::program = post_vaa_program.key(),
        bump
    )]
    pub posted_vaa:       Box<Account<'info, AnchorVaa>>,
    /// CHECK: program that called post_vaa
    pub post_vaa_program: AccountInfo<'info>,
}

impl crate::accounts::PostUpdates {
    pub fn populate(payer: &Pubkey, posted_vaa: &Pubkey, post_vaa_program: &Pubkey) -> Self {
        crate::accounts::PostUpdates {
            payer:            *payer,
            posted_vaa:       *posted_vaa,
            post_vaa_program: *post_vaa_program,
        }
    }
}
