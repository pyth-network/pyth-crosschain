use {
    crate::{
        instructions::sighash,
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
    #[account(mut)]
    pub payer:                 Signer<'info>,
    /// CHECK: whitelist
    pub accumulator_whitelist: UncheckedAccount<'info>,
    /// CHECK: instructions introspection sysvar
    #[account(address = sysvar::instructions::ID)]
    pub ixs_sysvar:            UncheckedAccount<'info>,
    pub accumulator_program:   Program<'info, AccumulatorUpdaterProgram>,
}


pub fn update_price<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdatePrice<'info>>,
    params: UpdatePriceParams,
) -> Result<()> {
    let mut account_data = vec![];
    let schemas = get_schemas(PythAccountType::Price);

    {
        let pyth_price_acct = &mut ctx.accounts.pyth_price_account.load_mut()?;
        pyth_price_acct.update(params)?;

        let price_full_data = FullPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;

        account_data.push(price_full_data);


        let price_compact_data =
            CompactPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;
        account_data.push(price_compact_data);
    }


    let account_schemas = schemas.into_iter().map(|s| s.to_u8()).collect::<Vec<u8>>();

    UpdatePrice::invoke_cpi_solana(ctx, account_data, PythAccountType::Price, account_schemas)
}

impl<'info> UpdatePrice<'info> {
    pub fn invoke_cpi_solana(
        ctx: Context<'_, '_, '_, 'info, UpdatePrice<'info>>,
        account_data: Vec<Vec<u8>>,
        account_type: PythAccountType,
        account_schemas: Vec<u8>,
    ) -> anchor_lang::Result<()> {
        let mut accounts = vec![
            AccountMeta::new(ctx.accounts.payer.key(), true),
            AccountMeta::new_readonly(ctx.accounts.accumulator_whitelist.key(), false),
            AccountMeta::new_readonly(ctx.accounts.ixs_sysvar.key(), false),
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
                sighash("global", "update_inputs"),
                ctx.accounts.pyth_price_account.key(),
                account_data,
                account_type.to_u32(),
                account_schemas,
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
