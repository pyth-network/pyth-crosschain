use {
    anchor_lang::{
        prelude::*,
        solana_program::{
            native_token::LAMPORTS_PER_SOL,
            system_instruction,
        },
    },
    pyth_solana_receiver_sdk::price_update::{
        get_feed_id_from_hex,
        PriceUpdateV2,
    },
};

declare_id!("2e5gZD3suxgJgkCg4pkoogxDKszy1SAwokz8mNeZUj4M");

pub const MAXIMUM_AGE: u64 = 3600; // 1 hour
pub const FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

#[program]
pub mod send_usd {
    use super::*;

    pub fn send(ctx: Context<Send>, amount_in_usd: u64) -> Result<()> {
        let price_update = &mut ctx.accounts.price_update;
        let price = price_update.get_price_no_older_than(
            &Clock::get()?,
            MAXIMUM_AGE,
            &get_feed_id_from_hex(FEED_ID)?,
        )?;

        let amount_in_lamports = LAMPORTS_PER_SOL
            .checked_mul(10_u64.pow(price.exponent.abs().try_into().unwrap()))
            .unwrap()
            .checked_mul(amount_in_usd)
            .unwrap()
            .checked_div(price.price.try_into().unwrap())
            .unwrap();

        let transfer_instruction = system_instruction::transfer(
            ctx.accounts.payer.key,
            ctx.accounts.destination.key,
            amount_in_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.destination.to_account_info(),
            ],
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount_in_usd : u64)]
pub struct Send<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(mut)]
    /// CHECK : Just a destination
    pub destination:    AccountInfo<'info>,
    pub price_update:   Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
}
