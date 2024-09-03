# Express Relay Solana SDK

This is the Express Relay SDK for Solana programs wishing to integrate with Express Relay. It helps integrating programs check for Express Relay permissioning in a transaction.

## Install

You can install this SDK for use in your crate via `cargo`:

```bash
cargo add express-relay-solana
```

## Usage

This SDK can be used in Anchor or non-Anchor Solana programs. The primary method in this SDK is a helper function that constructs a CPI to the Express Relay program's `CheckPermission` instruction that checks permissioning within the transaction. A transaction is permissioned by Express Relay if it contains a `SubmitBid` instruction with the matching `permission` and `router` accounts.

## Example

See the below example for an integrated program whose single instruction does nothing except check for permissioning.

```rust
pub mod state;

use {
    crate::state::EXPRESS_RELAY_PID,
    anchor_lang::{
        prelude::*,
        solana_program::sysvar::instructions as sysvar_instructions,
    },
    express_relay_solana::check_permission_cpi,
};

declare_id!("HYCgALnu6CM2gkQVopa1HGaNf8Vzbs9bomWRiKP267P3");

#[program]
pub mod dummy {
    use super::*;

    pub fn do_nothing(ctx: Context<DoNothing>) -> Result<()> {
        check_permission_cpi(
            ctx.accounts.express_relay.key(),
            ctx.accounts.sysvar_instructions.to_account_info(),
            ctx.accounts.permission.to_account_info(),
            ctx.accounts.router.to_account_info()
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct DoNothing<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // CHECK: this is the express relay PID
    #[account(address = EXPRESS_RELAY_PID)]
    pub express_relay: UncheckedAccount<'info>,

    /// CHECK: this is the sysvar instructions account
    #[account(address = sysvar_instructions::ID)]
    pub sysvar_instructions: UncheckedAccount<'info>,

    /// CHECK: this is the permission key
    pub permission: UncheckedAccount<'info>,

    /// CHECK: this is the address to receive express relay fees at
    pub router: UncheckedAccount<'info>,
}
```
