// We can't do much about the size of `anchor_lang::error::Error`.
#![allow(clippy::result_large_err)]

use {anchor_lang::prelude::*, instructions::*};

pub mod instructions;
pub mod message;
mod state;

declare_id!("Dg5PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod mock_cpi_caller {
    use super::*;

    /// Creates a `PriceAccount` with the given parameters
    pub fn add_price<'info>(
        ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
        params: AddPriceParams,
    ) -> Result<()> {
        instructions::add_price(ctx, params)
    }

    /// Updates a `PriceAccount` with the given parameters
    pub fn update_price<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdatePrice<'info>>,
        params: UpdatePriceParams,
    ) -> Result<()> {
        instructions::update_price(ctx, params)
    }

    /// num_messages is the number of 1kb messages to send to the CPI
    pub fn cpi_max_test<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdatePrice<'info>>,
        params: UpdatePriceParams,
        msg_sizes: Vec<u16>,
    ) -> Result<()> {
        instructions::cpi_max_test(ctx, params, msg_sizes)
    }
}

#[cfg(test)]
mod test {
    use {super::*, anchor_lang::InstructionData};

    #[test]
    fn ix_discriminator() {
        let a = &(message_buffer::instruction::PutAll {
            base_account_key: anchor_lang::prelude::Pubkey::default(),
            messages: vec![],
        }
        .data()[..8]);

        let sighash = sighash("global", ACCUMULATOR_UPDATER_IX_NAME);
        println!(
            r"
            a: {a:?}
            sighash: {sighash:?}
            ",
        );
        assert_eq!(a, &sighash);
    }
}
