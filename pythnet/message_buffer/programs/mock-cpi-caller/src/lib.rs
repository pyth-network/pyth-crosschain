use {
    anchor_lang::prelude::*,
    instructions::*,
};

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
    use {
        super::*,
        anchor_lang::InstructionData,
        solana_sdk::instruction::Instruction,
    };

    #[test]
    fn ix_discriminator() {
        let messages = vec![vec![0], vec![1]];
        let account_metas: Vec<AccountMeta> = vec![];

        let sighash = sighash("global", ACCUMULATOR_UPDATER_IX_NAME);
        let raw_put_all_parameters = Instruction::new_with_borsh(
            crate::ID,
            &(sighash, Pubkey::default().to_bytes()),
            account_metas,
        )
        .data;
        println!("raw_put_all_parameters: {:?}", raw_put_all_parameters);
        // let put_all_ix = &(
        //     message_buffer::instruction::PutAll {
        //         base_account_key: anchor_lang::prelude::Pubkey::default(),
        //         messages:         messages.clone(),
        //     }
        //     .data(),
        //     account_metas.clone(),
        // )
        //     .data();
        // // let put_all_ix = &(message_buffer::instruction::PutAll {
        // //     base_account_key: anchor_lang::prelude::Pubkey::default(),
        // //     messages:         messages.clone(),
        // // }
        // // .data());
        // println!("put_all_ix: {:?}", put_all_ix.clone());

        let a = &(message_buffer::instruction::PutAll {
            base_account_key: anchor_lang::prelude::Pubkey::default(),
            messages,
        }
        .data()[..8]);


        println!(
            r"
            a: {a:?}
            sighash: {sighash:?}
            ",
        );
        assert_eq!(a, &sighash);
    }
}
