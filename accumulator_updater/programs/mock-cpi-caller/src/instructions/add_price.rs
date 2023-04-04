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
    accumulator_updater::{
        cpi::accounts as AccumulatorUpdaterCpiAccts,
        program::AccumulatorUpdater as AccumulatorUpdaterProgram,
    },
    anchor_lang::{
        prelude::*,
        solana_program::sysvar,
    },
};

pub fn add_price<'info>(
    ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
    params: AddPriceParams,
) -> Result<()> {
    let mut account_data: Vec<Vec<u8>> = vec![];
    let schemas = get_schemas(PythAccountType::Price);

    {
        let pyth_price_acct = &mut ctx.accounts.pyth_price_account.load_init()?;

        pyth_price_acct.init(params)?;

        let price_full_data = FullPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;

        account_data.push(price_full_data);


        let price_compact_data =
            CompactPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;
        account_data.push(price_compact_data);
    }


    let account_schemas = schemas.into_iter().map(|s| s.to_u8()).collect::<Vec<u8>>();

    // 44444 compute units
    // AddPrice::invoke_cpi_anchor(ctx, account_data, PythAccountType::Price, account_schemas)
    // 44045 compute units
    AddPrice::invoke_cpi_solana(ctx, account_data, PythAccountType::Price, account_schemas)
}


impl<'info> AddPrice<'info> {
    fn emit_inputs_ctx(
        &self,
        remaining_accounts: &[AccountInfo<'info>],
    ) -> CpiContext<'_, '_, '_, 'info, AccumulatorUpdaterCpiAccts::EmitInputs<'info>> {
        let mut cpi_ctx = CpiContext::new(
            self.accumulator_program.to_account_info(),
            AccumulatorUpdaterCpiAccts::EmitInputs {
                payer:              self.payer.to_account_info(),
                whitelist_verifier: AccumulatorUpdaterCpiAccts::WhitelistVerifier {
                    whitelist:  self.accumulator_whitelist.to_account_info(),
                    ixs_sysvar: self.ixs_sysvar.to_account_info(),
                },
                system_program:     self.system_program.to_account_info(),
            },
        );


        cpi_ctx = cpi_ctx.with_remaining_accounts(remaining_accounts.to_vec());
        cpi_ctx
    }

    /// invoke cpi call using anchor
    fn invoke_cpi_anchor(
        ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
        account_data: Vec<Vec<u8>>,
        account_type: PythAccountType,
        account_schemas: Vec<u8>,
    ) -> anchor_lang::Result<()> {
        accumulator_updater::cpi::emit_inputs(
            ctx.accounts.emit_inputs_ctx(ctx.remaining_accounts),
            ctx.accounts.pyth_price_account.key(),
            account_data,
            account_type.to_u32(),
            account_schemas,
        )?;
        Ok(())
    }


    /// invoke cpi call using solana
    pub fn invoke_cpi_solana(
        ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
        account_data: Vec<Vec<u8>>,
        account_type: PythAccountType,
        account_schemas: Vec<u8>,
    ) -> anchor_lang::Result<()> {
        let mut accounts = vec![
            AccountMeta::new(ctx.accounts.payer.key(), true),
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
        let create_inputs_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.accumulator_program.key(),
            accounts,
            data: (
                //anchor ix discriminator/identifier
                sighash("global", "emit_inputs"),
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
        anchor_lang::solana_program::program::invoke(&create_inputs_ix, account_infos)?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct AddPriceParams {
    pub id:         u64,
    pub price:      u64,
    pub price_expo: u64,
    pub ema:        u64,
    pub ema_expo:   u64,
}

#[derive(Accounts)]
#[instruction(params: AddPriceParams)]
pub struct AddPrice<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"pyth".as_ref(), b"price".as_ref(), &params.id.to_le_bytes()],
        bump,
        space = 8 + PriceAccount::INIT_SPACE
    )]
    pub pyth_price_account:    AccountLoader<'info, PriceAccount>,
    #[account(mut)]
    pub payer:                 Signer<'info>,
    /// also needed for accumulator_updater
    pub system_program:        Program<'info, System>,
    /// CHECK: whitelist
    pub accumulator_whitelist: UncheckedAccount<'info>,
    /// CHECK: instructions introspection sysvar
    #[account(address = sysvar::instructions::ID)]
    pub ixs_sysvar:            UncheckedAccount<'info>,
    pub accumulator_program:   Program<'info, AccumulatorUpdaterProgram>,
    // Remaining Accounts
    // should all be new uninitialized accounts
}
