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

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    pub fn update(
        _ctx: Context<Update>,
        data: Vec<u8>,
        recovery_id: u8,
        signature: [u8; 64],
    ) -> Result<()> {
        use {
            hex::ToHex,
            solana_program::{
                keccak,
                secp256k1_recover::secp256k1_recover,
            },
        };

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

    /// Verify the updates using the posted_vaa account
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
#[instruction(vaa_hash: [u8; 32])]
pub struct PostUpdates<'info> {
    #[account(mut)]
    pub payer:         Signer<'info>,
    pub posted_vaa:    Box<Account<'info, AnchorVaa>>,
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
