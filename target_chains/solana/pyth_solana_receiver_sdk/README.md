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

## Anchor Compatibility Matrix

`pyth-solana-receiver-sdk` has major versions aligned with Anchor framework releases and their underlying `borsh` serializer:

| `pyth-solana-receiver-sdk` Version | Anchor Framework (`anchor-lang`) | Borsh Version | Status |
|:---|:---|:---|:---|
| `^2.0.0` | `1.0.x` | `1.5`+ / `1.6`+ | **Current / Recommended** for Anchor 1.x and Solana 2.x/3.x |
| `1.2.0` | `0.30.x` – `0.32.1` | `0.10.x` | Legacy release for Anchor 0.30–0.32 |

### Version Conflict Resolution (Issue #3756)

If your project uses `anchor-lang 1.0.x` and you specify `pyth-solana-receiver-sdk = "1.2.0"`, cargo compilation will fail with:

```text
error[E0277]: the trait bound `pythnet_sdk::messages::PriceFeedMessage: BorshSerialize` is not satisfied
  --> src/price_update.rs:49:1
   |
49 | #[account]
   | ^^^^^^^^^^ the trait `BorshSerialize` is not implemented for `pythnet_sdk::messages::PriceFeedMessage`
   |
note: there are multiple different versions of crate `borsh` in the dependency graph
```

This error is caused by a transitive `borsh` mismatch between `anchor-lang 0.32.1` (which uses `borsh 0.10.4`) and `anchor-lang 1.0.x` / `pythnet-sdk` (which use `borsh 1.x`).

**To resolve:**
- For projects using **Anchor 1.0.x**, update `Cargo.toml`:
  ```toml
  [dependencies]
  anchor-lang = { version = "1.0.2", features = ["init-if-needed"] }
  pyth-solana-receiver-sdk = "^2.0.0"
  ```
- For legacy projects using **Anchor 0.32.1**, pin to the 1.x series:
  ```toml
  [dependencies]
  anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
  pyth-solana-receiver-sdk = "~1.2.0"
  ```

