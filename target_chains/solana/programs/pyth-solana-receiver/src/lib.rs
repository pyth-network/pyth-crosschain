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
    wormhole_anchor_sdk::wormhole::{
        SignatureSetData,
        SEED_PREFIX_POSTED_VAA,
    },
};

declare_id!("DvPfMBZJJwKgJsv2WJA8bFwUMn8nFd5Xpioc6foC3rse");
pub const POST_VAA: u8 = 2;

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
        let signature_set = &ctx.accounts.signature_set;
        require_keys_eq!(
            vaa.meta.signature_set,
            signature_set.key(),
            ReceiverError::InvalidSignatureSet
        );

        let (expected_vaa_pubkey, _) = Pubkey::find_program_address(
            &[SEED_PREFIX_POSTED_VAA, &signature_set.hash],
            //TODO: expected program owner of the posted_vaa account should come from config account that can only be modified by governance
            &wormhole_anchor_sdk::wormhole::program::id(),
        );
        require_keys_eq!(
            vaa.key(),
            expected_vaa_pubkey,
            ReceiverError::InvalidVaaAccountKey
        );

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
    pub payer:         Signer<'info>,
    pub posted_vaa:    Box<Account<'info, AnchorVaa>>,
    /// The signature set that signed the Vaa. This is used as an additional check to
    /// ensure that the `posted_vaa.signature_set()` matches the `signature_set` account and for
    /// checking the address of the `posted_vaa` by using the `signature_set.hash` as a seed to
    /// derive the expected `posted_vaa` address.
    pub signature_set: Box<Account<'info, SignatureSetData>>,
}

impl crate::accounts::PostUpdates {
    pub fn populate(payer: &Pubkey, posted_vaa: &Pubkey, signature_set: &Pubkey) -> Self {
        crate::accounts::PostUpdates {
            payer:         *payer,
            posted_vaa:    *posted_vaa,
            signature_set: *signature_set,
        }
    }
}
