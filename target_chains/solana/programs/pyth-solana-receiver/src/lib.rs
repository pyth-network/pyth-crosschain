use state::config::Config;

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
    state::{
        anchor_vaa::AnchorVaa,
        config::DataSource,
    },
};

declare_id!("DvPfMBZJJwKgJsv2WJA8bFwUMn8nFd5Xpioc6foC3rse");

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, initial_config: Config) -> Result<()> {
        let config = &mut ctx.accounts.config;
        **config = initial_config;
        Ok(())
    }

    pub fn request_governance_authority_transfer(
        ctx: Context<Governance>,
        target_governance_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.target_governance_authority = Some(target_governance_authority);
        Ok(())
    }

    pub fn authorize_governance_authority_transfer(
        ctx: Context<AuthorizeGovernanceAuthorityTransfer>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.governance_authority = config.target_governance_authority.ok_or(error!(
            ReceiverError::NonexistentGovernanceAuthorityTransferRequest
        ))?;
        config.target_governance_authority = None;
        Ok(())
    }

    pub fn set_data_sources(
        ctx: Context<Governance>,
        valid_data_sources: Vec<DataSource>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.valid_data_sources = valid_data_sources;
        Ok(())
    }

    pub fn set_fee(ctx: Context<Governance>, single_update_fee_in_lamports: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.single_update_fee_in_lamports = single_update_fee_in_lamports;
        Ok(())
    }

    pub fn set_wormhole_address(ctx: Context<Governance>, wormhole: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.wormhole = wormhole;
        Ok(())
    }

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
        let unchecked_vaa = &ctx.accounts.posted_vaa;
        require_keys_eq!(
            *unchecked_vaa.owner,
            //TODO: expected owner should come from config account that can only be modified by governance
            wormhole_anchor_sdk::wormhole::program::id(),
            ReceiverError::WrongVaaOwner
        );
        let vaa = AnchorVaa::try_deserialize(&mut &**(unchecked_vaa.try_borrow_data()?))
            .map_err(|_| ReceiverError::DeserializeVaaFailed)?;

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


pub const CONFIG_SEED: &str = "config";

#[derive(Accounts)]
#[instruction(initial_config : Config)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(init, space = Config::LEN, payer=payer, seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config:         Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Governance<'info> {
    #[account(constraint =
        payer.key() == config.governance_authority @
        ReceiverError::GovernanceAuthorityMismatch
    )]
    pub payer:  Signer<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct AuthorizeGovernanceAuthorityTransfer<'info> {
    #[account(constraint =
        payer.key() == config.target_governance_authority.ok_or(error!(ReceiverError::NonexistentGovernanceAuthorityTransferRequest))? @
        ReceiverError::TargetGovernanceAuthorityMismatch
    )]
    pub payer:  Signer<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
}


#[derive(Accounts)]
pub struct PostUpdates<'info> {
    #[account(mut)]
    pub payer:      Signer<'info>,
    /// CHECK: Account with verified vaa. Wormhole's verify_signatures & post_vaa will perform the
    /// necessary checks so that it is assumed that the posted_vaa account is valid and the
    /// signatures have been verified if the owner & discriminator are correct. The
    /// `posted_vaa.payload` contains a merkle root and the price_updates are verified against this
    /// merkle root.
    ///
    /// Using `UncheckedAccount` so that we can deserialize the account without the `Owner` trait
    /// being implemented to a hard-coded value. The owner is checked in the ix itself using the
    /// `config` account.
    pub posted_vaa: UncheckedAccount<'info>,
}


impl crate::accounts::PostUpdates {
    pub fn populate(payer: &Pubkey, posted_vaa: &Pubkey) -> Self {
        crate::accounts::PostUpdates {
            payer:      *payer,
            posted_vaa: *posted_vaa,
        }
    }
}
