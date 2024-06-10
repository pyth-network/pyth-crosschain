# Pyth Solana Receiver Rust SDK

This is a Rust SDK to build Solana programs that consume Pyth price updates posted by the Pyth Solana Receiver.

It is available on [crates.io](https://crates.io/crates/pyth-solana-receiver-sdk).

## Pull model

The Pyth Solana Receiver allows users to consume Pyth price updates on a pull basis. This means that the user is responsible for submitting the price data on-chain whenever they want to interact with an app that requires a price update.

Price updates get posted into price update accounts, owned by the Receiver contract. Once an update has been posted to a price update account, it can be used by anyone by simply passing the price update account as one of the accounts in a Solana instruction.
Price update accounts can be closed by whoever wrote them to recover the rent.

## Warning

When using price update accounts, you should check that the accounts are owned by the Pyth Solana Receiver contract to avoid impersonation attacks. This SDK checks this if you use Anchor's `Account` struct (ex: `Account<'info, PriceUpdateV2>`).

You should also check the `verification_level` of the account. Read more about this [here](./src/price_update.rs) in the documentation for `VerificationLevel`.

## Example use

A Solana program can consume price update accounts created by the Pyth Solana Receiver using this SDK:

```rust
use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("2e5gZD3suxgJgkCg4pkoogxDKszy1SAwokz8mNeZUj4M");

pub const MAXIMUM_AGE: u64 = 60; // One minute
pub const FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"; // SOL/USD price feed id from https://pyth.network/developers/price-feed-ids

#[program]
pub mod my_first_pyth_app {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let price_update = &mut ctx.accounts.price_update;
        let price = price_update.get_price_no_older_than(
            &Clock::get()?,
            MAXIMUM_AGE,
            &get_feed_id_from_hex(FEED_ID)?,
        )?;
        /// Do something with the price
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub price_update: Account<'info, PriceUpdateV2>,
    // Add more accounts here
}


```
