use {
    anchor_lang::system_program,
    state::config::Config,
    state::{
        config::Config,
        price_update::PriceUpdateV1,
    },
    wormhole_core_bridge_solana::state::EncodedVaa,
};

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
    state::config::DataSource,
};

declare_id!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

#[program]
pub mod pyth_solana_receiver {
    use {
        super::*,
        serde_wormhole::RawMessage,
        solana_program::system_instruction,
        wormhole_sdk::vaa::{
            Body,
            Header,
        },
    };

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
        price_update: MerklePriceUpdate,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let payer = &ctx.accounts.payer;
        let encoded_vaa = &ctx.accounts.encoded_vaa;
        let treasury = &ctx.accounts.treasury;
        let price_update_account = &mut ctx.accounts.price_update_account;

        if payer.lamports()
            < Rent::get()?
                .minimum_balance(0)
                .saturating_add(config.single_update_fee_in_lamports)
        {
            return err!(ReceiverError::InsufficientFunds);
        };

        let transfer_instruction = system_instruction::transfer(
            payer.key,
            treasury.key,
            config.single_update_fee_in_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
            ],
        )?;

        let (header, body): (Header, Body<&RawMessage>) =
            serde_wormhole::from_slice(&ctx.accounts.encoded_vaa.buf).unwrap();

        let valid_data_source = config.valid_data_sources.iter().any(|x| {
            *x == DataSource {
                chain:   body.emitter_chain.into(),
                emitter: Pubkey::from(body.emitter_address.0),
            }
        });
        if !valid_data_source {
            return err!(ReceiverError::InvalidDataSource);
        }

        let wormhole_message = WormholeMessage::try_from_bytes(body.payload)
            .map_err(|_| ReceiverError::InvalidWormholeMessage)?;
        let root: MerkleRoot<Keccak160> = MerkleRoot::new(match wormhole_message.payload {
            WormholePayload::Merkle(merkle_root) => merkle_root.root,
        });

        if !root.check(price_update.proof, price_update.message.as_ref()) {
            return err!(ReceiverError::InvalidPriceUpdate);
        }

        let message = from_slice::<byteorder::BE, Message>(price_update.message.as_ref())
            .map_err(|_| ReceiverError::DeserializeMessageFailed)?;

        match message {
            Message::PriceFeedMessage(price_feed_message) => {
                price_update_account.write_authority = payer.key();
                price_update_account.verified_signatures = encoded_vaa.header.verified_signatures;
                price_update_account.price_message = price_feed_message;
            }
            Message::TwapMessage(twap_message) => {
                return err!(ReceiverError::UnsupportedMessageType);
            }
        }

        Ok(())
    }
}


pub const CONFIG_SEED: &str = "config";
pub const TREASURY_SEED: &str = "treasury";

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
    pub payer:                Signer<'info>,
    #[account(owner = config.wormhole)]
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config:               Account<'info, Config>,
    #[account(seeds = [TREASURY_SEED.as_ref()], bump)]
    /// CHECK: This is just a PDA controlled by the program
    pub treasury:             AccountInfo<'info>,
    #[account(init, payer =payer, space = PriceUpdateV1::LEN)]
    pub price_update_account: Account<'info, PriceUpdateV1>,
    pub system_program:       Program<'info, System>,
}

impl crate::accounts::Initialize {
    pub fn populate(payer: &Pubkey) -> Self {
        let config = Pubkey::find_program_address(&[CONFIG_SEED.as_ref()], &crate::ID).0;
        crate::accounts::Initialize {
            payer: *payer,
            config,
            system_program: system_program::ID,
        }
    }
}

impl crate::accounts::PostUpdates {
    pub fn populate(payer: &Pubkey, posted_vaa: &Pubkey) -> Self {
        crate::accounts::PostUpdates {
            payer:      *payer,
            posted_vaa: *posted_vaa,
        }
    }

}
