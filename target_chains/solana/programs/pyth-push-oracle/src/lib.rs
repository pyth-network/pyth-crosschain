use {
    anchor_lang::prelude::*,
    pyth_solana_receiver::{
        cpi::accounts::PostUpdate,
        program::PythSolanaReceiver,
        PostUpdateParams,
    },
    pyth_solana_receiver_sdk::{
        price_update::PriceUpdateV2,
        PYTH_PUSH_ORACLE_ID,
    },
    pythnet_sdk::messages::FeedId,
};

pub mod sdk;

pub const ID: Pubkey = PYTH_PUSH_ORACLE_ID;

#[error_code]
pub enum PushOracleError {
    #[msg("Updates must be monotonically increasing")]
    UpdatesNotMonotonic,
    #[msg("Trying to update price feed with the wrong feed id")]
    PriceFeedMessageMismatch,
}
#[program]
pub mod pyth_push_oracle {

    use super::*;

    pub fn update_price_feed(
        ctx: Context<UpdatePriceFeed>,
        params: PostUpdateParams,
        shard_id: u16,
        feed_id: FeedId,
    ) -> Result<()> {
        let cpi_program = ctx.accounts.pyth_solana_receiver.to_account_info().clone();
        let cpi_accounts = PostUpdate {
            payer:                ctx.accounts.payer.to_account_info().clone(),
            encoded_vaa:          ctx.accounts.encoded_vaa.to_account_info().clone(),
            config:               ctx.accounts.config.to_account_info().clone(),
            treasury:             ctx.accounts.treasury.to_account_info().clone(),
            price_update_account: ctx.accounts.price_feed_account.to_account_info().clone(),
            system_program:       ctx.accounts.system_program.to_account_info().clone(),
            write_authority:      ctx.accounts.price_feed_account.to_account_info().clone(),
        };

        let seeds = &[
            &shard_id.to_le_bytes(),
            feed_id.as_ref(),
            &[*ctx.bumps.get("price_feed_account").unwrap()],
        ];
        let signer_seeds = &[&seeds[..]];
        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);


        let current_timestamp = {
            if ctx.accounts.price_feed_account.data_is_empty() {
                0
            } else {
                let price_feed_account_data = ctx.accounts.price_feed_account.try_borrow_data()?;
                let price_feed_account =
                    PriceUpdateV2::try_deserialize(&mut &price_feed_account_data[..])?;
                price_feed_account.price_message.publish_time
            }
        };
        pyth_solana_receiver::cpi::post_update(cpi_context, params)?;
        {
            let price_feed_account_data = ctx.accounts.price_feed_account.try_borrow_data()?;
            let price_feed_account =
                PriceUpdateV2::try_deserialize(&mut &price_feed_account_data[..])?;

            require!(
                price_feed_account.price_message.publish_time > current_timestamp,
                PushOracleError::UpdatesNotMonotonic
            );
            require!(
                price_feed_account.price_message.feed_id == feed_id,
                PushOracleError::PriceFeedMessageMismatch
            );
        }
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(params : PostUpdateParams, shard_id : u16, feed_id : FeedId)]
pub struct UpdatePriceFeed<'info> {
    #[account(mut)]
    pub payer:                Signer<'info>,
    pub pyth_solana_receiver: Program<'info, PythSolanaReceiver>,
    pub encoded_vaa:          AccountInfo<'info>,
    pub config:               AccountInfo<'info>,
    #[account(mut)]
    pub treasury:             AccountInfo<'info>,
    #[account(mut, seeds = [&shard_id.to_le_bytes(), &feed_id], bump)]
    pub price_feed_account:   AccountInfo<'info>,
    pub system_program:       Program<'info, System>,
}
