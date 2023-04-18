use {
    crate::{
        instructions::{
            sighash,
            ACCUMULATOR_UPDATER_IX_NAME,
        },
        message::{
            get_schemas,
            price::{
                CompactPriceMessage,
                FullPriceMessage,
            },
            AccumulatorSerializer,
        },
        state::{
            PriceAccount,
            PythAccountType,
        },
    },
    accumulator_updater::program::AccumulatorUpdater as AccumulatorUpdaterProgram,
    anchor_lang::{
        prelude::*,
        solana_program::sysvar,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct UpdatePriceParams {
    pub price:      u64,
    pub price_expo: u64,
    pub ema:        u64,
    pub ema_expo:   u64,
}


#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
    mut,
    seeds = [
    b"pyth".as_ref(),
    b"price".as_ref(),
    &pyth_price_account.load()?.id.to_le_bytes()
    ],
    bump,
    )]
    pub pyth_price_account:    AccountLoader<'info, PriceAccount>,
    // #[account(mut)]
    // pub payer:                 Signer<'info>,
    #[account(mut)]
    pub fund:                  SystemAccount<'info>,
    /// Needed for accumulator_updater
    pub system_program:        Program<'info, System>,
    /// CHECK: whitelist
    pub accumulator_whitelist: UncheckedAccount<'info>,
    /// CHECK: instructions introspection sysvar
    #[account(address = sysvar::instructions::ID)]
    pub ixs_sysvar:            UncheckedAccount<'info>,
    pub accumulator_program:   Program<'info, AccumulatorUpdaterProgram>,
}

/// Updates the mock pyth price account and calls accumulator-updater
/// update_inputs ix
pub fn update_price<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdatePrice<'info>>,
    params: UpdatePriceParams,
) -> Result<()> {
    let mut inputs = vec![];
    let _schemas = get_schemas(PythAccountType::Price);

    {
        let pyth_price_acct = &mut ctx.accounts.pyth_price_account.load_mut()?;
        pyth_price_acct.update(params)?;

        let price_full_data = FullPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;

        inputs.push(price_full_data);


        let price_compact_data =
            CompactPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;
        inputs.push(price_compact_data);
    }


    UpdatePrice::emit_accumulator_inputs(ctx, inputs)
}

impl<'info> UpdatePrice<'info> {
    /// Invoke accumulator-updater emit-inputs ix cpi call
    pub fn emit_accumulator_inputs(
        ctx: Context<'_, '_, '_, 'info, UpdatePrice<'info>>,
        values: Vec<Vec<u8>>,
    ) -> anchor_lang::Result<()> {
        let mut accounts = vec![
            AccountMeta::new(ctx.accounts.fund.key(), false),
            AccountMeta::new_readonly(ctx.accounts.accumulator_whitelist.key(), false),
            AccountMeta::new_readonly(ctx.accounts.ixs_sysvar.key(), false),
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        ];
        accounts.extend_from_slice(
            &ctx.remaining_accounts
                .iter()
                .map(|a| AccountMeta::new(a.key(), false))
                .collect::<Vec<_>>(),
        );
        let update_inputs_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.accumulator_program.key(),
            accounts,
            data: (
                //anchor ix discriminator/identifier
                sighash("global", ACCUMULATOR_UPDATER_IX_NAME),
                ctx.accounts.pyth_price_account.key(),
                values,
            )
                .try_to_vec()
                .unwrap(),
        };
        let account_infos = &mut ctx.accounts.to_account_infos();
        account_infos.extend_from_slice(ctx.remaining_accounts);
        anchor_lang::solana_program::program::invoke(&update_inputs_ix, account_infos)?;
        Ok(())
    }
}
