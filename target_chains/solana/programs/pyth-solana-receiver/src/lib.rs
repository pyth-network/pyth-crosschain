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
        ACCUMULATOR_EMITTER_ADDRESS,
    },
    serde::Deserialize,
    sha3::Digest,
    state::AnchorVaa,
    std::io::Write,
};

declare_id!("DvPfMBZJJwKgJsv2WJA8bFwUMn8nFd5Xpioc6foC3rse");

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    /// Verify the updates using the posted_vaa account. This should be called after the client
    /// has already called verify_signatures & post_vaa. Wormhole's verify_signatures & post_vaa
    /// will perform the necessary checks so that we can assume that the posted_vaa account is
    /// valid and the signatures have been verified.
    ///
    ///  * `price_updates` Vec of bytes for the updates to verify and post on-chain
    #[allow(unused_variables)]
    pub fn post_updates(
        ctx: Context<PostUpdates>,
        // TODO: update pythnet_sdk to implement BorshSerialize, BorshDeserialize
        // for MerklePriceUpdate as well as Keccak160 price_updates can be passed
        // in as Vec<MerklePriceUpdate>
        price_updates: Vec<Vec<u8>>,
    ) -> Result<()> {
        let vaa = &ctx.accounts.posted_vaa;
        // TODO: expected emitter_chain should come from config account that can only be modified by governance
        require_eq!(
            vaa.emitter_chain(),
            <wormhole::Chain as Into<u16>>::into(wormhole::Chain::Pythnet),
            ReceiverError::InvalidEmitterChain
        );

        require_keys_eq!(
            Pubkey::new_from_array(*vaa.emitter_address()),
            // TODO: expected emitter_address should come from config account that can only be modified by governance
            Pubkey::new_from_array(ACCUMULATOR_EMITTER_ADDRESS),
            ReceiverError::InvalidEmitterAddress
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
                .map_err(|_| ReceiverError::DeserializeMessageFailed)?;

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
pub struct PostUpdates<'info> {
    #[account(mut)]
    pub payer:      Signer<'info>,
    /// Account with verified vaa. Wormhole's verify_signatures & post_vaa will perform the
    /// necessary checks so that it is assumed that the posted_vaa account is valid and the
    /// signatures have been verified if the owner & discriminator are correct. The
    /// `posted_vaa.payload` contains a merkle root and the price_updates are verified against this
    /// merkle root.
    pub posted_vaa: Box<Account<'info, AnchorVaa>>,
}

impl crate::accounts::PostUpdates {
    pub fn populate(payer: &Pubkey, posted_vaa: &Pubkey) -> Self {
        crate::accounts::PostUpdates {
            payer:      *payer,
            posted_vaa: *posted_vaa,
        }
    }
}
