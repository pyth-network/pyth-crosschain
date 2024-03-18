use {
    anchor_lang::prelude::*,
    pyth_solana_receiver::{
        cpi::accounts::PostUpdate,
        program::PythSolanaReceiver,
        PostUpdateParams,
    },
    pyth_solana_receiver_sdk::{
        config::{
            Config,
            DataSource,
        },
        price_update::{
            PriceUpdateV1,
            VerificationLevel,
        },
    },
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot,
        hashers::keccak256_160::Keccak160,
        messages::{
            FeedId,
            Message,
        },
        wire::{
            from_slice,
            v1::{
                MerklePriceUpdate,
                WormholeMessage,
                WormholePayload,
            },
        },
    },
    solana_program::{
        keccak,
        program_memory::sol_memcpy,
        secp256k1_recover::secp256k1_recover,
        system_instruction,
    },
    wormhole_core_bridge_solana::{
        sdk::{
            legacy::AccountVariant,
            VaaAccount,
        },
        state::GuardianSet,
    },
    wormhole_raw_vaas::{
        utils::quorum,
        GuardianSetSig,
        Vaa,
    },
};

// pub mod error;
pub mod sdk;

declare_id!("F9SP6tBXw9Af7BYauo7Y2R5Es2mpv8FP5aNCXMihp6Za");

#[error_code]
pub enum OracleInstanceError {
    #[msg("Updates must be monotonically increasing")]
    UpdatesNotMonotonic,
    #[msg("Price feed id mismatch")]
    PriceFeedMessageMismatch
}
#[program]
pub mod oracle_instance {

    use super::*;

    pub fn update_price_feed(
        ctx: Context<UpdatePriceFeed>,
        params: PostUpdateParams,
        feed_id: FeedId,
    ) -> Result<()> {
        let cpi_program = ctx.accounts.pyth_solana_receiver.to_account_info().clone();
        let cpi_accounts = PostUpdate {
            payer:                ctx.accounts.payer.to_account_info().clone(),
            write_authority : ctx.accounts.price_feed_account.to_account_info().clone(),
            encoded_vaa:          ctx.accounts.encoded_vaa.to_account_info().clone(),
            config:               ctx.accounts.config.to_account_info().clone(),
            treasury:             ctx.accounts.treasury.to_account_info().clone(),
            price_update_account: ctx.accounts.price_feed_account.to_account_info().clone(),
            system_program:       ctx.accounts.system_program.to_account_info().clone(),
        };

        let seeds = &[
            feed_id.as_ref(),
            &[*ctx.bumps.get("price_feed_account").unwrap()],
        ];
        let signer_seeds = &[&seeds[..]];
        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        let old_timestamp = {
            let price_feed_account_data = ctx.accounts.price_feed_account.try_borrow_data()?;
            let price_feed_account = PriceUpdateV1::try_deserialize(&mut &price_feed_account_data[..])?;
            price_feed_account.price_message.publish_time
        };
        pyth_solana_receiver::cpi::post_update(cpi_context, params)?;
        {
            let price_feed_account_data = ctx.accounts.price_feed_account.try_borrow_data()?;
            let price_feed_account = PriceUpdateV1::try_deserialize(&mut &price_feed_account_data[..])?;

            if price_feed_account.price_message.publish_time <= old_timestamp {
                return Err(OracleInstanceError::UpdatesNotMonotonic.into());
            }
            if price_feed_account.price_message.feed_id != feed_id {
                return Err(OracleInstanceError::PriceFeedMessageMismatch.into());
            }
        }



        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(params : PostUpdateParams, feed_id : FeedId)]
pub struct UpdatePriceFeed<'info> {
    #[account(mut)]
    pub payer:                Signer<'info>,
    pub pyth_solana_receiver: Program<'info, PythSolanaReceiver>,
    pub encoded_vaa:          AccountInfo<'info>,
    pub config:               AccountInfo<'info>,
    #[account(mut)]
    pub treasury:             AccountInfo<'info>,
    #[account(mut, seeds = [&feed_id], bump)]
    pub price_feed_account:   AccountInfo<'info>,
    pub system_program:       Program<'info, System>,
}
